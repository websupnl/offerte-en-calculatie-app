# 🚀 Roadmap: Van Tool naar Sales-Machine

Hier zijn de drie geniale concepten uitgebreid uitgewerkt in een actieplan.

---

## 🎯 1. "The Stalker" (Real-time Sales Intelligence)
*Het doel: Precies weten wanneer je klant "warm" is zodat je op het perfecte moment kunt toeslaan.*

### Hoe het werkt:
1.  **Tracker Pixel/Event:** Zodra de `/q/[token]` pagina wordt geladen, vuren we een event af naar een nieuwe API route `/api/portal/track`.
2.  **Smart Metadata:** We loggen niet alleen *dat* ze kijken, maar ook:
    *   **Apparaat:** Kijken ze op hun telefoon (even snel tussendoor) of op een desktop (serieus aan het vergelijken)?
    *   **Locatie:** Op basis van IP (bijv. "Klant is nu op kantoor in Leeuwarden").
    *   **Sectie-tracking:** (Bonus) Welke pagina van de 5 pagina's bekijken ze het langst? (Blijven ze hangen bij de prijs of bij het technisch advies?).
3.  **Directe Ping:** Via een Telegram Bot API krijg jij direct een berichtje:
    > "🔔 **Klant kijkt!** Jan de Vries opent nu de offerte 'Zonnepanelen 12st'. Locatie: Drachten. Apparaat: iPhone."

### To-do:
- [ ] Telegram Bot aanmaken via BotFather en `TELEGRAM_CHAT_ID` + `TELEGRAM_TOKEN` in `.env` zetten.
- [ ] Route `/api/portal/track` maken die `viewedAt` update en Telegram bericht verstuurt.
- [ ] Frontend hook toevoegen aan de Quote Portal om dit event te triggeren.

---

## 📸 2. "The Inspector" (AI Vision Materiaal-extractie)
*Het doel: Een foto van een meterkast of dak omzetten in een concept-materiaallijst.*

### Hoe het werkt:
1.  **Upload Interface:** In de Quote Builder komt een knop "Scan Situatie (Foto)".
2.  **GPT-4o Vision:** We sturen de foto naar OpenAI met een specifieke technische system prompt.
    *   *Prompt:* "Je bent een expert installateur. Analyseer deze meterkast. Welke componenten zie je? (Aantal groepen, merk, hoofdschakelaar). Welke aanpassingen zijn nodig voor een 3-fase omvormer?"
3.  **Mapping:** De AI geeft een JSON terug met materialen. Jouw app matcht deze automatisch met jouw `Product` database op basis van naam/categorie.

### To-do:
- [ ] Foto upload component toevoegen (Base64 of Vercel Blob).
- [ ] API Route `/api/ai/vision-extract` maken die GPT-4o Vision aanroept.
- [ ] Logica schrijven om AI-output te matchen met je eigen productlijst (fuzzy matching).
- [ ] **Note:** GPT-4o is verbazingwekkend goed in het herkennen van merken (ABB, Eaton, Hager) en componenten op scherpe foto's.

---

## 💰 3. "The Accountant" (Winst & Marge Dashboard)
*Het doel: Nooit meer een project aannemen waar je stiekem geld op toelegt.*

### Hoe het werkt:
1.  **Inkooprijs (Cost Price):** Voeg een veld `costPrice` toe aan het `Product` model in Prisma.
2.  **Hidden Margin Layer:** In de Quote Builder zie jij (en alleen jij) bij elk item:
    *   Inkoop: €100 | Verkoop: €160 | **Winst: €60 (37.5%)**
3.  **Project Totaal:** Onder de totaalprijs staat voor jou een klein grijs kadertje:
    *   "Totale marge op dit project: €2.450".
4.  **Winst Dashboard:** Een nieuwe pagina `/admin/dashboard` die laat zien:
    *   Gecumuleerde winst van alle `ACCEPTED` offertes deze maand.
    *   "Potentiële winst" (van alle openstaande offertes).

### To-do:
- [ ] `costPrice` toevoegen aan `Product` en `QuoteItem` (om de prijs vast te leggen op het moment van offreren).
- [ ] Prisma migratie draaien.
- [ ] UI updates in de Quote Builder om marges te tonen (alleen voor ingelogde admins!).
- [ ] Dashboard pagina bouwen met eenvoudige statistieken.

---

### Waar zal ik als eerste mee beginnen? 
Ik stel voor om **"The Stalker" (Telegram pings)** als eerste te doen, want dat geeft je direct die "wow" factor als je offertes verstuurt!
