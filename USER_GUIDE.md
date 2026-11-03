# Meridian — First-Time User Guide

> **Ye guide kis ke liye hai?**
> Jo pehli baar Meridian kholega — manager, team lead, employee ya administrator.
> Yahan har screen, har button aur har approval ka matlab simple bhasha mein samjhaya
> gaya hai. Technical knowledge ki zaroorat nahi hai.

- **Login link:** jo link aapko share kiya gaya hai (hosting ke baad milta hai).
- **Demo password:** `demo1234`

---

## 1. Meridian kya hai?

Meridian ek **team task manager** hai. Iska basic idea simple hai:

> Kaam approval ke through aage badhta hai — approval ko bypass nahi kiya ja sakta.

Aap yahan ye sab kar sakte hain:

- task banana, assign karna aur uska status track karna
- do level ki approval: pehle **Manager**, phir **Senior Manager**
- due date badalne ke liye proper extension request
- manager aur senior manager ki **alag-alag ratings**
- meeting transcript se AI ki madad se summary, decisions aur action items nikalna
- team-wise reports aur workload risk dekhna

Sab kuch role ke hisaab se limited hai. Ek employee ko dusri team ka data nahi dikhta,
aur Admin kaam ko approve nahi kar sakta.

---

## 2. Kaun kaun use karega (4 roles)

| Role | Kaun hai | Main kaam |
|---|---|---|
| **Employee** | Team member | Apne tasks banana, kaam karna, complete karke submit karna, extension maangna |
| **Manager** | Team lead | Task assign karna, activation approve karna, completion review karna, rating dena |
| **Senior Manager** | Department head | Final approval dena, department ke reports aur workload dekhna, rating dena |
| **Administrator** | System admin | Users, departments aur AI settings manage karna. Tasks mein sirf read-only |

> **Important:** Administrator task create, approve ya rate **nahi** kar sakta. Ye jaan-boojh kar aisa design hai — platform manage karne wala workflow mein hissa nahi leta.

---

## 3. Pehli baar login kaise karein

1. Browser mein apna Meridian link kholein.
2. Email aur password daalein.
3. **Sign in** dabayein.
4. Pehli baar login karne par aap seedha **Dashboard** par pahunch jayenge.

Demo accounts neeche section 14 mein diye hain. Login page par accounts ki list nahi dikhti — credentials aapko alag se milenge.

> **Tip:** Agar page 30–60 second le raha hai, to hosting service sleep mode se wake ho rahi hai. Thoda intezaar karein, phir normal chalega.

---

## 4. Ek nazar mein screen

Login ke baad left side mein menu dikhega:

| Menu | Kya milta hai |
|---|---|
| **Dashboard** | Aapke liye zaroori kaam, overdue tasks, team pulse, recent activity |
| **Tasks** | Saare tasks — List ya Board view, filter aur search ke saath |
| **Action Center** | Aapke decision ka intezaar karne wali cheezein — activation, reviews, extensions, ratings |
| **Team** | Aapke scope ke log aur unka workload |
| **Reports** | Assigned vs self-created work ka split report, CSV export |
| **Meetings** | Meeting transcript, AI summary, decisions, action items |
| **AI Insights** | Workload aur due-date risk ki AI analysis |
| **Administration** | Sirf Admin ko — users, departments, AI settings |

Top bar par **notification bell** hai. Jab aapke paas approval, rating ya extension ka kaam aata hai, wahan red dot dikhta hai.

---

## 5. Sabse important: task ka lifecycle

Har task ek fixed raaste se guzarta hai. Ye samajh liya to baaki sab aasan hai.

### 5.1 Task banane ke do tarike

| Tarika | Kaun banata hai | Shuru mein status | Approval chahiye? |
|---|---|---|---|
| **Manager assign kare** | Manager ya Senior Manager | **Active** | Nahi — seedha kaam shuru ho sakta hai |
| **Employee khud banaye** | Employee apne liye | **Awaiting activation** | Haan — Manager ka approval zaroori |

> Employee apne liye task bana kar bhi seedha kaam shuru **nahi** kar sakta. Pehle manager ko activation approve karna padta hai.

### 5.2 Status ka matlab

| Status (screen par) | Matlab |
|---|---|
| **Awaiting activation** | Employee ne task banaya, manager ke approval ka intezaar |
| **Activation rejected** | Manager ne reject kiya; ab creator revise karke resubmit karega |
| **Active** | Task approved hai, kaam shuru kiya ja sakta hai |
| **In progress** | Assignee ne kaam shuru kar diya |
| **Manager review** | Assignee ne complete karke submit kiya; manager ke review ka intezaar |
| **Senior review** | Manager ne approve kiya; ab senior manager ka final approval baaki |
| **Returned to manager** | Senior ne wapas manager ko bheja; manager decide karega |
| **Needs rework** | Correction maangi gayi; assignee dobara kaam karega |
| **Completed** | Dono level ki approval ho gayi; ab ratings ka time |
| **Cancelled** | Task bina complete hue band |

### 5.3 Activation approval (sirf self-created tasks)

1. Employee **Tasks → New task** se apne liye task banata hai.
2. Task **Awaiting activation** mein chala jata hai.
3. Manager ke **Action Center** page par wo task aata hai.
4. Manager **Approve activation** dabata hai → task **Active** ho jata hai.
5. Agar manager **Reject activation** dabaye, to reason likhna zaroori hai → task **Activation rejected**.
6. Ab sirf task banane wala employee use edit karke **Resubmit for activation** kar sakta hai.

### 5.4 Kaam shuru karna

1. Assignee task kholega.
2. **Start work** dabayega.
3. Status **In progress** ho jayega aur manager ko notification chala jayega.

> Sirf assignee hi task start kar sakta hai.

### 5.5 Completion — do level ki approval

Ye sabse important rule hai: **completion kabhi ek approval se poori nahi hoti.**

1. Assignee kaam khatam karke **Submit for completion** dabata hai.
2. Status **Manager review** ho jata hai.
3. Manager check karke **Approve & send to senior** dabata hai.
4. Status **Senior review** ho jata hai.
5. Senior manager **Final approval** dabata hai.
6. Tab ja kar status **Completed** hota hai.

Agar manager ko kaam theek nahi laga:

- Manager **Return for rework** dabata hai → reason likhna zaroori → task wapas assignee ke paas **Needs rework** mein.

### 5.6 Senior reject kare to kya hota hai?

Ye rule naye users ko confuse karta hai, isliye dhyan se padhein:

> **Senior manager reject kare to task employee ke paas nahi jata — wo Manager ke paas jata hai.**

Aage manager ke paas do raste hain:

| Manager ka decision | Result |
|---|---|
| **Request corrections** | Task assignee ke paas **Needs rework** mein jata hai |
| **Resubmit to senior** | Wahi kaam bina employee change ke dobara senior ke paas jata hai |

Iska matlab: senior-level rejection ki responsibility manager ki hai.

### 5.7 Due date extension kaise maangein

Due date seedha edit nahi hoti. Uske liye extension workflow hai:

1. Assignee task ke andar **Request extension** dabata hai.
2. Naya date (purane se baad ka) aur reason likhta hai.
3. Manager ke paas request aati hai.
4. Manager approve kare → request **Senior Manager** ke paas jati hai.
5. Senior approve kare → task ki due date update ho jati hai.
6. Koi bhi level reject kare → request **Rejected**, due date waisi hi rehti hai.

> Ek task par ek waqt mein sirf ek extension request pending ho sakti hai.

### 5.8 Ratings (task complete hone ke baad)

Task **Completed** hone ke baad manager aur senior manager rating de sakte hain:

- score **1 se 5**
- remarks likhna zaroori (kam se kam 3 character)
- manager aur senior ki rating **alag-alag** save hoti hai
- apni hi task ko rate nahi kar sakte
- pehle di gayi rating ko update bhi kiya ja sakta hai

### 5.9 Task cancel karna

- Kaun kar sakta hai: task banane wala ya assigned manager
- Reason likhna zaroori hai
- Completed ya already cancelled task cancel nahi ho sakta

### 5.10 Group tasks (do modes)

Group task tab use karein jab kaam kai logon ko milkar karna ho.

| | **Mode A — Full contribution** | **Mode B — Leader consolidated** |
|---|---|---|
| Har member ka alag contribution task | Haan | Haan |
| Sab contributions complete hona zaroori | **Haan** | Nahi |
| Leader kab submit kar sakta hai | Jab sab contributions complete hon | Kabhi bhi |
| Kab use karein | Jab har member ka kaam zaroori ho | Jab sirf final delivery matter kare |

Group banane ke rules:

- kam se kam **2 members**
- group leader wahi hota hai jo task ka assignee hai
- members leader ki team aur department ke andar hone chahiye
- har member ka apna audit trail hota hai

---

## 6. Har role ke liye 10-minute tour

### 6.1 Employee — pehla din

1. Login karke **Dashboard** dekhein — "My open tasks", "Overdue", "Your action queue".
2. **Tasks → New task** se apne liye task banayein. Status **Awaiting activation** hoga.
3. Manager ke approve karne ka intezaar karein. Notification bell par update aayega.
4. Approve hone ke baad task kholein aur **Start work** dabayein.
5. Kaam khatam hone par **Submit for completion** dabayein.
6. Rework aaye to comments padhein, sudhar karein, dobara submit karein.
7. Task complete hone ke baad manager aur senior ki ratings task detail mein dikhengi.

### 6.2 Manager — pehla din

1. **Action Center** kholein — yahan aapke saare pending kaam milenge:
   - Activation approvals (naye self-created tasks)
   - Manager reviews (submit hue tasks)
   - Extensions (due date requests)
   - Ratings (completed tasks jinke liye rating baaki hai)
2. Employee ka task approve ya reject karein. Reject karte waqt clear reason likhein.
3. Completion review mein **Approve & send to senior** ya **Return for rework** chunein.
4. **Tasks → New task** se apne aap ko ya apni team ko task assign karein — ye seedha **Active** hoga.
5. **Team** page par apne direct reports ka workload dekhein.
6. **Reports** mein "Tasks assigned by manager" aur "Tasks created by employee" alag-alag dekhein.
7. Completed tasks par apni **1–5 rating** dein.

> Manager sirf apne direct reports ko assign kar sakta hai. Dusri team ke log assign list mein nahi aayenge.

### 6.3 Senior Manager — pehla din

1. Login karke **Action Center** kholein — final approvals aur extension decisions yahan honge.
2. **Senior review** wale task ko **Final approval** ya **Return to manager** karein.
3. Return karte waqt reason likhein — wo manager ko dikhega.
4. **Team** aur **Reports** mein poore department ka data dekhein.
5. **AI Insights** mein department ka workload aur due-date risk dekhein.
6. Completed tasks par apni alag rating dein.
7. **Meetings** mein department ki meetings aur transcripts dekh sakte hain.

### 6.4 Administrator — pehla din

1. **Administration → Overview** mein users, departments aur AI status dekhein.
2. **Users** tab se naya user banayein, role badlein, ya password reset karein.
3. **Departments** tab se department aur uska senior manager set karein.
4. **AI settings** mein OpenAI-compatible API key aur model set karein (optional).
5. Task detail khol kar dekh sakte hain, lekin koi workflow action nahi kar sakte.

> Admin ko saare tasks dikhte hain — oversight ke liye — lekin create, approve, rate ya cancel nahi kar sakta.

---

## 7. Meetings + AI

Meeting notes manually likhna bhool jaiye — transcript paste karein aur AI se extract karwayein.

1. **Meetings → New meeting** kholein.
2. Title, date aur participants chunein.
3. Transcript paste karein (optional — baad mein bhi add ho sakta hai).
4. **Create meeting** dabayein.
5. Meeting detail mein **Run AI extraction** dabayein.
6. AI ye cheezein banata hai:
   - summary
   - decisions
   - action items
7. Kisi bhi action item ke saath **Create task** dabayein — wo seedha governed task ban jata hai.

**Privacy rules:**

- Raw transcript sirf Admin, creator, department senior manager, aur creator/participants ke manager dekh sakte hain.
- Employee participants ko sirf summary, decisions aur action items dikhte hain — poora transcript nahi.
- Agar AI key set nahi hai, to built-in analysis chalta hai. Result simple hota hai, lekin feature kaam karta hai.

---

## 8. Reports

Reports do tarah ke kaam ko **alag-alag** dikhati hain, phir combined total:

| Report | Matlab |
|---|---|
| **Tasks assigned by manager** | Jo kaam manager ne assign kiya (creator ≠ assignee) |
| **Tasks created by employee** | Jo kaam employee ne khud banaya |
| **Combined total** | Dono ka jod — reference ke liye |

Har report mein ye metrics milte hain:

- total, completed, open, overdue
- on-time completion rate
- average cycle days
- average effort hours
- manager rating aur senior rating ka average
- per-person breakdown

**Export CSV** button se poora report Excel mein khole ja sakne wale format mein download hota hai.

---

## 9. AI Insights

**AI Insights** page batata hai:

- kis person par kitna workload hai
- kis task ki due date sabse zyada risk mein hai
- kaunse tasks late hone ke chance zyada hain
- suggested interventions

Ye analysis sirf aapke **authorised scope** ke data se banti hai. Employee ko dusri team ka data nahi dikhega, manager ko sirf apni team ka, senior ko apne department ka.

Agar AI key configured hai to "Live AI" label dikhta hai. Warna "Built-in analysis" ya "Built-in fallback" — dono mein result aata hai.

---

## 10. Notifications

Bell icon par ye alerts aate hain:

- naya task assign hua
- activation approval chahiye
- completion review chahiye
- extension request aayi ya decide hui
- rating mili
- group task update

Bell kholein → notification par click karein → seedha us task par pahunch jayenge. **Mark all read** se sab clear ho jate hain.

---

## 11. Privacy: kaun kya dekh sakta hai

| Cheez | Employee | Manager | Senior Manager | Admin |
|---|---|---|---|---|
| Apne tasks | Haan | Haan | Haan | Read-only |
| Dusron ko assign karna | Nahi | Direct reports | Department | Nahi |
| Activation approve | Nahi | Haan | Apni line ke liye | Nahi |
| Completion review | Nahi | Level 1 | Level 2 | Nahi |
| Team oversight | Nahi | Direct reports | Department | Sab |
| Reports | Apne | Apne + reports | Department | Organisation |
| Meetings | Apni/participant | Apne + reports ki | Department | Sab |
| Raw transcript | Sirf apni banayi | Creator/participant ke manager | Department | Sab |
| Users/departments/AI manage | Nahi | Nahi | Nahi | Haan |

> Ye rules sirf UI mein nahi — **server par enforce** hote hain. URL se bhi doosre team ka data nahi khul sakta.

---

## 12. Common first-time problems (FAQ)

**Q: Mujhe task dikh nahi raha.**
Aapka task aapke scope se bahar hai. Employee ko sirf apne, apne banaye, ya group ke tasks dikhte hain. Manager ko direct reports ke, senior ko department ke.

**Q: Approve button nahi dikh raha.**
Aap us task ke assigned manager ya senior manager nahi hain, ya task us status mein nahi hai jahan approval allowed hai.

**Q: Employee ne task banaya, lekin Start work button nahi hai.**
Task **Awaiting activation** hai. Pehle manager ko approve karna hoga.

**Q: Senior ne reject kiya, par employee ke paas wapas kyun nahi aaya?**
Ye design hai. Senior rejection pehle manager ke paas jata hai. Manager decide karega ki corrections maange ya dobara senior ko bheje.

**Q: Due date edit kyun nahi ho rahi?**
Due date seedha change nahi hoti. **Request extension** use karein — manager aur senior dono approve karenge tab date badlegi.

**Q: Rating option kyun nahi hai?**
Rating sirf **Completed** task par milti hai, aur sirf us task ke manager/senior ko. Apni task rate nahi kar sakte.

**Q: Admin task create kyun nahi kar sakta?**
Admin platform manage karta hai, workflow mein hissa nahi leta. Ye security boundary hai.

**Q: AI kaam nahi kar raha.**
Admin → AI settings mein key check karein. Key na ho to built-in analysis chalta hai — feature band nahi hota.

**Q: Login nahi ho raha.**
Email-password check karein. Password `demo1234` hai. Bahut zyada galat attempts par thodi der ke liye login block ho sakta hai.

**Q: Data reset ho gaya.**
Free hosting plan par disk temporary hota hai. Service restart hone par demo data wapas aa jata hai. Permanent data ke liye Railway + volume wala setup chahiye.

**Q: Group task submit nahi ho raha.**
Mode A mein saare member contribution tasks pehle complete hone chahiye. Task detail mein readiness reason dikhega.

**Q: Meeting transcript nahi dikh raha.**
Raw transcript restricted hai. Employee participant ko sirf summary, decisions aur action items milte hain.

---

## 13. Status glossary (quick reference)

| Status | Kis ke paas action hai |
|---|---|
| Awaiting activation | Manager |
| Activation rejected | Task creator (edit + resubmit) |
| Active | Assignee (start) |
| In progress | Assignee (submit) |
| Manager review | Manager |
| Senior review | Senior Manager |
| Returned to manager | Manager |
| Needs rework | Assignee |
| Completed | Manager aur Senior (rating) |
| Cancelled | Koi nahi — task band |

---

## 14. Demo accounts

Password sabka: **`demo1234`**

| Role | Naam | Email |
|---|---|---|
| Employee | Elena Rossi | `elena.rossi@meridian.io` |
| Manager | James Rivera | `james.rivera@meridian.io` |
| Senior Manager | Sarah Chen | `sarah.chen@meridian.io` |
| Administrator | Maya Patel | `maya.patel@meridian.io` |

Demo team chain:

```
Elena Rossi (Employee)
      |
      v
James Rivera (Manager)
      |
      v
Sarah Chen (Senior Manager)
```

Isliye Elena ka task pehle James ke paas jayega, phir Sarah ke paas.

---

## 15. Manager ke liye 3-minute demo script

Agar aap kisi ko jaldi mein project dikhana chahte hain, to yahi sequence follow karein:

1. **Employee** se login karein → naya task banayein → status "Awaiting activation" dikhayein.
2. **Manager** se login karein → Action Center → task approve karein.
3. Wapas **Employee** → task start karein → complete karke submit karein.
4. **Manager** → review approve karein.
5. **Senior Manager** → final approve karein → status "Completed".
6. **Ratings** dikhayein — manager aur senior ki alag-alag.
7. **Reports** → assigned vs self-created split dikhayein.
8. **Meetings** → transcript process karke action item se task banayein.
9. **AI Insights** → workload risk dikhayein.

Bas — poora product 3 minute mein cover ho jata hai.

---

## 16. Ek line mein yaad rakhein

> **Task banayein → approve karwayein → kaam karein → submit karein → Manager → Senior → Completed → Rating.**

Aur haan: due date sirf extension se badalti hai, aur senior ka reject seedha employee ke paas nahi jata.
