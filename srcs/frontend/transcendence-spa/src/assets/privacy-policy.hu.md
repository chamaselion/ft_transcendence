# Adatvédelmi irányelvek

**1.0 verzió · Utoljára frissítve: 2026. 10. 21.**

## 1. Adatkezelő

A **Trans Edit** („a Szolgáltatás”, „mi”, „minket”) üzemeltetője **a bszikora által vezetett 42-es csapat**, székhelye: **Weipertstraße 8-10, 74076 Heilbronn, Németország**. Adatvédelmi kérdésekben az **afelger@student.42heilbronn.de** e-mail-címen érhet el minket.

## 2. Általunk gyűjtött személyes adatok

Kizárólag azokat az adatokat gyűjtjük és kezeljük, amelyek az együttműködő dokumentumszerkesztő biztosításához feltétlenül szükségesek:

- **Fiókadatok:** Felhasználónév (`login`), e-mail-cím, sózott és kivonatolt (hashed) jelszó (`bcryptjs`), valamint a hozzárendelt felhasználói szerepkör (`user` vagy `admin`).
- **OAuth 2.0 identitások:** Ha GitHub- vagy 42-fiókkal jelentkezik be vagy kapcsolja össze fiókját, tároljuk a szolgáltató nevét, a szolgáltatói felhasználói azonosítót, az e-mail-cím hitelesítési állapotát és a profilkép URL-címét.
- **Profilkép:** Az Ön által opcionálisan feltöltött profilkép, amelyet EXIF-metaadatoktól megtisztított, 256×256 képpontos WebP képpé alakítunk, és elkülönített, S3-kompatibilis objektumtárunkban (`user-icons`) tárolunk.
- **Dokumentumok és együttműködési adatok:** Dokumentumcímek, blokkalapú tartalom, tulajdonjog, megosztási jogosultságok (`viewer` vagy `editor`), valamint ideiglenes valós idejű blokkzárolások.
- **Hitelesítési és biztonsági naplók:** Aktív munkamenet-tokenek (`auth_sessions`) bejelentkezési és lejárati időbélyeggel, kivonatolt egyszer használatos ellenőrző kódok (`one_time_challenges`), OAuth CSRF állapot-tokenek (`oauth_state_intents`), valamint GDPR auditnaplók (`gdpr_audit_events`).

## 3. Hogyan és miért kezeljük az Ön adatait (Jogalapok)

Az EU általános adatvédelmi rendelete (GDPR) 6. cikkének (1) bekezdése alapján az Ön adatait az alábbi jogalapokon kezeljük:

- **Szerződés teljesítése (GDPR 6. cikk (1) bekezdés b) pont):** Fiókja regisztrálásához és hitelesítéséhez, a 2FA ellenőrző kódok kézbesítéséhez, dokumentumai valós idejű tárolásához és szinkronizálásához, a megosztási jogosultságok kezeléséhez, valamint az Ön által kezdeményezett AI-kidolgozási és fordítási kérések teljesítéséhez.
- **Jogos érdek (GDPR 6. cikk (1) bekezdés f) pont):** Infrastruktúránk védelméhez, a sebességkorlátozások (rate limit) érvényesítéséhez, a jogosulatlan hozzáférés és visszaélések megelőzéséhez, valamint a munkamenetek sértetlenségének fenntartásához.
- **Jogi kötelezettség (GDPR 6. cikk (1) bekezdés c) pont):** Az érintetti jogok (hozzáférés, adathordozhatóság, törlés) teljesítéséhez és a GDPR-műveletek ellenőrzési nyomvonalának fenntartásához.

## 4. Amit nem teszünk

- **Nem** adjuk el, nem adjuk bérbe és nem kereskedünk az Ön személyes adataival.
- **Nem** használjuk fel az Ön személyes adatait vagy dokumentumtartalmait AI-modellek betanítására.
- **Nem** használunk harmadik féltől származó hirdetési, elemzési vagy viselkedéskövető cookie-kat.

## 5. Cookie-k és helyi tárhely

A 2002/58/EK irányelvvel (ePrivacy) és a GDPR 6. cikkével összhangban kizárólag feltétlenül szükséges, első féltől származó tárolóelemeket használunk:

- **`token` (HTTP-only, Secure, SameSite=Strict cookie):** Legfeljebb 7 napig tárolja az Ön hitelesített JWT munkamenetét.
- **`app-theme` (Helyi tároló):** Megjegyzi a választott megjelenési témát (világos vagy sötét mód).
- **`app-locale` (Helyi tároló):** Megjegyzi a választott felületi és fordítási nyelvet (`en`, `de`, `hu`).
- **`cookie-consent` (Helyi tároló):** Megjegyzi a cookie-tájékoztató tudomásulvételét.

## 6. Adattovábbítás és adatfeldolgozók

Adatait konténerizált környezetünkben (PostgreSQL adatbázis és RustFS S3 objektumtár) tároljuk. Külső adatfeldolgozókat csak akkor veszünk igénybe, ha azok kifejezetten konfigurálva vannak, és Ön kezdeményezi a műveletet:

- **SMTP e-mail-szolgáltató:** Egyszer használatos bejelentkezési, jelszó-visszaállítási és GDPR megerősítő kódok kézbesítése.
- **OAuth 2.0 szolgáltatók (GitHub, 42):** Kizárólag akkor használatos, ha Ön e szolgáltatókon keresztül jelentkezik be vagy kapcsolja össze fiókját.
- **AI-szolgáltató (OpenAI, DeepSeek vagy Anthropic):** Amikor Ön AI-blokkkidolgozást vagy nyelvi fordítást indít, az érintett blokk szövegét kizárólag a válasz előállítása céljából továbbítjuk a konfigurált szolgáltatónak.

## 7. Adatmegőrzés és törlés

Személyes adatait aktív fiókja fennállásáig őrizzük meg. Amikor a **Felhasználói beállítások → Fiók törlése** menüpontban (e-mailes OTP-kóddal megerősítve) törli fiókját, felhasználói rekordja, dokumentumai, megosztásai, munkamenetei, OAuth-kapcsolatai és feltöltött profilképe az `ON DELETE CASCADE` adatbázis-szabályok és az S3 objektumtörlés révén véglegesen törlődnek.

## 8. Az Ön GDPR szerinti jogai (15–22. cikk)

Önnek joga van:

- **Hozzáférés és adathordozhatóság (15. és 20. cikk):** Személyes adatai teljes, géppel olvasható másolatát bármikor letöltheti **JSON** vagy **CSV** formátumban a **Felhasználói beállítások → Adatvédelem és GDPR** részben.
- **Helyesbítés (16. cikk):** Bármikor frissítheti felhasználónevét, e-mail-címét, jelszavát vagy profilképét a **Felhasználói beállításokban**.
- **Törlés / „Az elfeledtetéshez való jog” (17. cikk):** Véglegesen törölheti fiókját és minden kapcsolódó adatát a **Felhasználói beállításokban**.
- **Korlátozás, tiltakozás és panasz (18., 21., 77. cikk):** Vegye fel velünk a kapcsolatot az **afelger@student.42heilbronn.de** címen, vagy nyújtson be panaszt a nemzeti adatvédelmi felügyeleti hatósághoz.

