import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  FileText,
  Lock,
  MessagesSquare,
  Plus,
  Search,
  Sparkles,
  Users,
} from 'lucide-react';
import { api } from '../lib/api';
import { formatDateLong, todayISO } from '../lib/format';
import type { Directory, Meeting, User } from '../lib/types';
import { useApi, useAsyncAction } from '../hooks/useApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  Avatar,
  AvatarStack,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Modal,
  PageHeader,
  TabBar,
} from '../components/ui';

function MeetingCard({ meeting, onOpen }: { meeting: Meeting; onOpen: () => void }) {
  return (
    <article className="meeting-card" onClick={onOpen} role="button" tabIndex={0} onKeyDown={(event) => {
      if (event.key === 'Enter') onOpen();
    }}>
      <div className="meeting-top">
        <div className="meeting-icon">
          <MessagesSquare size={19} />
        </div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="meeting-title">{meeting.title}</div>
          <div className="meeting-sub">
            <CalendarDays size={11} /> {formatDateLong(meeting.meetingDate)}
            <span>·</span>
            {meeting.departmentName}
          </div>
        </div>
        {meeting.status === 'PROCESSED' ? (
          <span className="badge badge-green">
            <CheckCircle2 size={10} /> Processed
          </span>
        ) : (
          <span className="badge badge-amber">Draft</span>
        )}
      </div>

      <p className="meeting-summary">
        {meeting.summary ||
          (meeting.hasTranscript
            ? 'Transcript captured and waiting for AI extraction.'
            : 'No transcript has been added to this meeting yet.')}
      </p>

      <div className="meeting-foot">
        <AvatarStack
          people={meeting.participants.map((person) => ({
            id: person.id,
            name: person.fullName,
            color: person.avatarColor,
          }))}
          max={4}
          size={23}
        />
        <span className="meeting-stat">
          <Users size={12} /> {meeting.participants.length}
        </span>
        <span className="meeting-stat">
          <CheckCircle2 size={12} /> {meeting.decisionCount || 0}
        </span>
        <span className="meeting-stat">
          <ArrowRight size={12} /> {meeting.actionCount || 0}
        </span>
        {meeting.hasTranscript && (
          <span className="meeting-stat" style={{ marginLeft: 'auto' }}>
            {meeting.transcriptRestricted ? <Lock size={12} /> : <FileText size={12} />}
            {meeting.transcriptChars.toLocaleString()} chars
          </span>
        )}
      </div>
    </article>
  );
}

export default function MeetingsPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const toast = useToast();
  const meetings = useApi(() => api.meetings.list(), []);
  const directory = useApi<Directory>(() => api.directory(), []);
  const { busy, error, run, reset } = useAsyncAction();

  const [tab, setTab] = useState<'all' | 'processed' | 'draft'>('all');
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [meetingDate, setMeetingDate] = useState(todayISO());
  const [participantIds, setParticipantIds] = useState<string[]>([]);
  const [transcript, setTranscript] = useState('');
  const [participantSearch, setParticipantSearch] = useState('');

  const people: User[] = directory.data?.users || [];

  useEffect(() => {
    document.title = 'Meetings · Meridian';
  }, []);

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setMeetingDate(todayISO());
    setParticipantIds(user ? [user.id] : []);
    setTranscript('');
    setParticipantSearch('');
    reset();
  }, [open, user, reset]);

  const list = meetings.data?.meetings || [];
  const filtered = useMemo(
    () =>
      list.filter((meeting) => {
        if (tab === 'processed' && meeting.status !== 'PROCESSED') return false;
        if (tab === 'draft' && meeting.status !== 'DRAFT') return false;
        if (!query.trim()) return true;
        const needle = query.trim().toLowerCase();
        return (
          meeting.title.toLowerCase().includes(needle) ||
          meeting.summary.toLowerCase().includes(needle)
        );
      }),
    [list, tab, query],
  );

  const candidates = people.filter((person) =>
    participantSearch.trim()
      ? person.fullName.toLowerCase().includes(participantSearch.trim().toLowerCase()) ||
        person.title.toLowerCase().includes(participantSearch.trim().toLowerCase())
      : true,
  );

  function toggleParticipant(id: string) {
    if (id === user?.id) return;
    setParticipantIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const valid = title.trim().length >= 3 && Boolean(meetingDate);
    if (!valid) return;
    void run(
      () =>
        api.meetings.create({
          title: title.trim(),
          meetingDate,
          participantIds: participantIds.filter((id) => id !== user?.id),
          transcript: transcript.trim() || undefined,
        }),
      {
        onSuccess: (result) => {
          const meeting = (result as { meeting: Meeting }).meeting;
          toast.success(
            meeting.hasTranscript
              ? 'Meeting created — run AI extraction when you are ready.'
              : 'Meeting created without a transcript.',
          );
          setOpen(false);
          navigate(`/meetings/${meeting.id}`);
        },
      },
    );
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow={
          <>
            <Sparkles size={13} /> Meeting intelligence
          </>
        }
        title="Meetings"
        subtitle="Capture a transcript, extract the summary, decisions and action items with AI, then turn commitments into governed tasks. Raw transcripts stay restricted by role and team."
        actions={
          <button className="btn btn-primary" onClick={() => setOpen(true)}>
            <Plus size={15} /> New meeting
          </button>
        }
      />

      <div className="card">
        <div className="card-head" style={{ minHeight: 56 }}>
          <TabBar
            items={[
              { key: 'all', label: 'All meetings', count: list.length },
              {
                key: 'processed',
                label: 'Processed',
                count: list.filter((meeting) => meeting.status === 'PROCESSED').length,
              },
              {
                key: 'draft',
                label: 'Drafts',
                count: list.filter((meeting) => meeting.status === 'DRAFT').length,
              },
            ]}
            value={tab}
            onChange={(key) => setTab(key as 'all' | 'processed' | 'draft')}
          />
          <div className="card-head-actions">
            <div className="search-box" style={{ minWidth: 220 }}>
              <Search size={14} />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search meetings…"
              />
            </div>
          </div>
        </div>
      </div>

      {meetings.loading && !meetings.data ? (
        <LoadingBlock label="Loading meetings…" />
      ) : meetings.error ? (
        <ErrorBlock message={meetings.error} onRetry={meetings.reload} />
      ) : filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            title={list.length === 0 ? 'No meetings in your scope' : 'No meetings match this filter'}
            description="Meetings are visible only to their participants and the relevant management line. Create one to capture a transcript."
            icon={<MessagesSquare size={20} />}
            action={
              <button className="btn btn-primary btn-sm" onClick={() => setOpen(true)}>
                <Plus size={13} /> New meeting
              </button>
            }
          />
        </div>
      ) : (
        <div className="grid grid-3">
          {filtered.map((meeting) => (
            <MeetingCard
              key={meeting.id}
              meeting={meeting}
              onOpen={() => navigate(`/meetings/${meeting.id}`)}
            />
          ))}
        </div>
      )}

      <div className="form-note">
        <strong>Privacy model:</strong> raw transcripts are visible only to administrators, the
        meeting creator, the department senior manager, and managers of the creator or participants.
        Employee participants receive the derived summary, decisions and action items only.
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New meeting"
        subtitle="Add a transcript now to enable AI extraction."
        icon={<MessagesSquare size={18} />}
        size="wide"
        footer={
          <>
            <button className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button
              type="submit"
              form="meeting-form"
              className="btn btn-primary"
              disabled={busy || title.trim().length < 3}
            >
              {busy ? <span className="spinner" /> : <Plus size={15} />}
              Create meeting
            </button>
          </>
        }
      >
        <form id="meeting-form" onSubmit={submit} className="form-grid">
          {error && <div className="form-error span-2">{error}</div>}
          <div className="field span-2">
            <label htmlFor="meeting-title">Meeting title</label>
            <input
              id="meeting-title"
              className="input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="e.g. Q3 delivery review"
              maxLength={160}
              required
              autoFocus
            />
          </div>
          <div className="field">
            <label htmlFor="meeting-date">Meeting date</label>
            <input
              id="meeting-date"
              type="date"
              className="input"
              value={meetingDate}
              onChange={(event) => setMeetingDate(event.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Participants</label>
            <div className="row" style={{ gap: 6 }}>
              <AvatarStack
                people={participantIds
                  .map((id) => people.find((person) => person.id === id))
                  .filter(Boolean)
                  .map((person) => ({
                    id: (person as User).id,
                    name: (person as User).fullName,
                    color: (person as User).avatarColor,
                  }))}
                max={6}
                size={24}
              />
              <span className="muted tiny">{participantIds.length} selected</span>
            </div>
          </div>
          <div className="field span-2">
            <label>Invite people</label>
            <input
              className="input"
              value={participantSearch}
              onChange={(event) => setParticipantSearch(event.target.value)}
              placeholder="Search within your authorized scope…"
              style={{ marginBottom: 6, height: 34 }}
            />
            <div
              style={{
                border: '1px solid var(--line)',
                borderRadius: 10,
                padding: 8,
                maxHeight: 200,
                overflowY: 'auto',
                background: 'var(--surface-soft)',
              }}
            >
              {directory.loading && <div className="muted small" style={{ padding: 8 }}>Loading people…</div>}
              {!directory.loading && candidates.length === 0 && (
                <div className="muted small" style={{ padding: 8 }}>No people in scope.</div>
              )}
              {candidates.map((person) => {
                const isSelf = person.id === user?.id;
                const checked = participantIds.includes(person.id);
                return (
                  <label
                    key={person.id}
                    className="row"
                    style={{
                      padding: '6px 8px',
                      borderRadius: 8,
                      cursor: isSelf ? 'default' : 'pointer',
                      background: checked ? '#fff' : 'transparent',
                      border: checked ? '1px solid var(--line)' : '1px solid transparent',
                      marginBottom: 3,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={isSelf}
                      onChange={() => toggleParticipant(person.id)}
                    />
                    <Avatar name={person.fullName} color={person.avatarColor} size={25} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="person-name">
                        {person.fullName}
                        {isSelf && <span className="badge badge-slate" style={{ marginLeft: 6, height: 18 }}>You</span>}
                      </div>
                      <div className="person-meta">{person.title}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="field span-2">
            <label htmlFor="meeting-transcript">Transcript (optional)</label>
            <textarea
              id="meeting-transcript"
              className="textarea"
              value={transcript}
              onChange={(event) => setTranscript(event.target.value)}
              placeholder="Paste the raw meeting transcript. AI extraction will produce a summary, decisions and action items."
              maxLength={80000}
              style={{ minHeight: 150 }}
            />
            <span className="hint">
              Transcripts are stored securely and only returned to roles permitted to read them.
            </span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
