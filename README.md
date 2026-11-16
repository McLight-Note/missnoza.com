# Miss Noza — online shop

A mobile-first cosmetics and skincare shop with an owner dashboard. **The whole site is in Uzbek (Latin script)**: the shop, the admin area and the emails. This README stays in English.

- **Shop:** home page, catalogue with search / category filter / sorting, product pages with sizes or shades, cart, guest checkout, order confirmation, optional customer accounts.
- **Checkout:** an *order request* paid on delivery. No online card payment is taken or claimed.
- **Admin (`/admin`):** dashboard with date filters, sales by product, low-stock list, orders with status and internal notes, products, categories, images, stock, delivery fees, settings and an activity log.
- **Stack:** Next.js 16 (App Router, TypeScript, Tailwind CSS) on Vercel · Firebase Authentication and Cloud Firestore · Resend for email.
- **Runs on free plans.** Nothing in this project needs a paid Firebase plan: product photos are kept in the database instead of Cloud Storage. See [the free-plan limits](#free-plan-limits).

> **Status: not yet production-ready.** Everything below has been built and tested locally against the Firebase emulators and a mock email server (see [What has been checked](#what-has-been-checked)). It has **not** been run against a live Firebase project, a real email provider or a Vercel deployment — that needs your accounts. Work through the [go-live checklist](#go-live-checklist) before taking real orders.

---

## Where to fill in your shop details

Sign in as admin and open **`/admin/settings`** (menu item **Sozlamalar**). That one page holds everything customers see about the shop, and saving it updates the site straight away:

| Field on the page | What it is |
| --- | --- |
| Telefon, Email, Manzil, Ish vaqti | Phone, email, address and opening hours shown in the footer and on the contact page |
| Instagram / Telegram havolasi | Optional links |
| Eʼlon satri | The short line at the very top of the shop |
| Yetkazib berish hududlari va narxlari | Delivery areas and their fees |
| Bepul yetkazib berish chegarasi | Order value from which delivery is free (optional) |
| Yangi buyurtma xabarlari yuboriladigan email | Where new-order emails are sent |
| Onlayn buyurtmalarni qabul qilish | Untick to pause ordering |

Until you save it, the page shows placeholders (for example `+998 00 000 00 00`). Products, prices, stock and photos are under **Mahsulotlar**; categories under **Kategoriyalar**.

## Contents

1. [What you need to set up (and what may cost money)](#1-what-you-need-to-set-up-and-what-may-cost-money)
2. [Run it on your computer](#2-run-it-on-your-computer)
3. [Create the Firebase project](#3-create-the-firebase-project)
4. [Environment variables](#4-environment-variables)
5. [Set up email (Resend)](#5-set-up-email-resend)
6. [Create the first admin](#6-create-the-first-admin)
7. [Deploy to Vercel](#7-deploy-to-vercel)
8. [Phone numbers: allowed regions and testing](#8-phone-numbers-allowed-regions-and-testing)
9. [Customising the shop](#9-customising-the-shop)
10. [How it works (data and security)](#10-how-it-works-data-and-security)
11. [What has been checked](#what-has-been-checked)
12. [Go-live checklist](#go-live-checklist)

---

## 1. What you need to set up (and what may cost money)

Nothing works for real customers until these accounts exist. **All of them have a free plan that this shop fits into.** Limits change — the figures below are what the providers documented when this was written, so confirm each on the linked page.

| Service | Needed for | Free plan |
| --- | --- | --- |
| **Firebase** (Google), free *Spark* plan | Sign-in, database, product photos | No card needed. Daily allowances apply (below). [Pricing](https://firebase.google.com/pricing) |
| **Resend** | Order emails to you and customers; branded sign-in emails | Free tier with monthly and daily caps. You must **verify a sending domain** (DNS records, free) before you can email customers. [Pricing](https://resend.com/pricing) |
| **Vercel** | Hosting | The free *Hobby* plan works technically. Vercel's terms describe Hobby as for personal, non-commercial use, so check their current terms before taking paid orders on it. [Pricing](https://vercel.com/pricing) |
| **A domain name** | `missnoza.com`, and the email sender address | Yearly registration fee (the only unavoidable cost). |

### Free-plan limits

These are the limits you will actually notice on Firebase's free plan:

- **About 5 sign-in emails per day** ([Auth limits](https://firebase.google.com/docs/auth/limits)). This is shared by everyone: customers creating accounts **and you signing in to the admin**. Assume it applies even when the email is delivered through Resend.
  - Checkout never needs an account, so customers can always order as guests.
  - Sessions last 14 days (the longest Firebase allows), so you rarely need a new link. Avoid pressing *Sign out* in the admin unless you need to.
  - If the day's emails are used up, nobody can sign in until the next day — including you. New-order emails still arrive, and orders are safe.
- **Firestore: 50,000 reads and 20,000 writes per day, 1 GB stored.** Shop pages and photos are cached, so ordinary browsing uses very few reads. If a day's allowance runs out, the shop stops loading new data until the next day rather than charging you.
- **Photos live in the database** and count towards the 1 GB. Each photo is shrunk to under 1 MB before upload (typically 100–300 KB), which leaves room for a few thousand photos.

When the shop outgrows these, moving to Firebase's pay-as-you-go *Blaze* plan raises the sign-in email limit and the daily allowances without any code change.

Features that depend on outside setup:

- **Order notification and confirmation emails** — need Resend with a verified domain. Until then orders are still saved, and the dashboard flags each one whose email was not sent.
- **Sign-in** — needs Firebase Authentication with *Email link* enabled and your domain authorised.
- **Online card payments** — not included. Checkout is cash on delivery / manual payment only.
- **SMS** — not used anywhere. Phone numbers are collected for delivery contact only.

---

## 2. Run it on your computer

You need [Node.js](https://nodejs.org) 22 or newer.

```bash
npm install
cp .env.example .env.local   # then fill it in (section 4)
npm run dev                  # http://localhost:3000
```

Without Firebase settings the site still starts and shows a "shop is being set up" message, so you can look at the design first.

Useful commands:

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the site locally |
| `npm run build` / `npm start` | Production build / run it |
| `npm run lint` · `npm run typecheck` | Code checks |
| `npm run seed` | Add sample categories and products to an empty shop |
| `npm run admin:create -- admin@example.com` | Create an admin who signs in with a password (or change that password) |
| `npm run admin:grant -- you@example.com` | Give an email admin access |
| `npm run admin:revoke -- you@example.com` | Remove admin access and sign them out |
| `npm run admin:list` | List admins |
| `npm run firebase:deploy` | Publish security rules and indexes to Firebase |
| `npm run test:rules` | Test the database security rules in the emulator (needs Java 21+) |
| `npm run emulators` | Run Firebase locally, no account needed (needs Java 21+) |

### Optional: develop without a Firebase account

The Firebase emulators imitate Firebase on your machine. They need **Java 21 or newer**.

1. In `.env.local`, use the block at the bottom of `.env.example` (the "emulators" section) instead of real Firebase values.
2. `npm run emulators` in one terminal, `npm run seed` then `npm run dev` in another.
3. Sign-in emails are not really sent: the sign-in link is printed in the emulator terminal.

Never put the emulator variables on Vercel. The server refuses to start in production if they are present.

---

## 3. Create the Firebase project

In the [Firebase console](https://console.firebase.google.com):

1. **Create a project** (Google Analytics is not needed). Stay on the free *Spark* plan.
2. **Authentication → Get started → Sign-in method → Email/Password:** enable it **and** enable **Email link (passwordless sign-in)**.
3. **Authentication → Settings → Authorized domains:** add your real domain (for example `missnoza.com` and `www.missnoza.com`). `localhost` is already there for development.
4. **Firestore Database → Create database:** choose *production mode* and a region close to your customers. The region cannot be changed later.
5. **Project settings → General → Your apps → Web app (`</>`):** register an app. Copy `apiKey`, `authDomain`, `projectId` and `appId` — these are the `NEXT_PUBLIC_FIREBASE_*` values.
6. **Project settings → Service accounts → Generate new private key.** A JSON file downloads. It is a **secret**: do not commit it, email it or paste it anywhere public. You need `project_id`, `client_email` and `private_key` from it.

You do **not** need to set up Cloud Storage, Functions or Hosting.

Then publish the security rules and database indexes from this folder:

```bash
npx firebase-tools login
npx firebase-tools use --add      # pick your project 
npm run firebase:deploy           # firestore.rules and firestore.indexes.json
```

Index creation can take a few minutes. Until it finishes, the admin order list filtered by status and the customer order history may show an error.

---

## 4. Environment variables

Copy `.env.example` to `.env.local` for local work, and add the same names in Vercel for production. `.env.example` contains names and placeholders only.

| Variable | Secret? | What it is |
| --- | --- | --- |
| `NEXT_PUBLIC_SITE_URL` | no | Public address, e.g. `https://missnoza.com` (no trailing slash). Used in emails, sign-in links and SEO. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | no | Firebase web app config. Designed to be public. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | no | 〃 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | no | 〃 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | no | 〃 |
| `FIREBASE_PROJECT_ID` | no | `project_id` from the service-account file. |
| `FIREBASE_CLIENT_EMAIL` | **yes** | `client_email` from the service-account file. |
| `FIREBASE_PRIVATE_KEY` | **yes** | `private_key` from the service-account file, including the `-----BEGIN…` and `…END-----` lines. In `.env.local` wrap it in double quotes and keep the `\n` sequences. |
| `ADMIN_EMAILS` | sensitive | Comma-separated emails that become admins when they first sign in (section 6). |
| `ADMIN_PATH` | sensitive | Optional. A hard-to-guess name for the admin address, replacing `/admin` (section 6). |
| `RESEND_API_KEY` | **yes** | Resend API key. |
| `EMAIL_FROM` | no | Sender, e.g. `Miss Noza <orders@missnoza.com>`. The domain must be verified in Resend. |
| `ORDER_NOTIFICATION_EMAIL` | no | Where new-order emails go. Can be overridden in Admin → Sozlamalar. |
| `RATE_LIMIT_SALT` | yes | Optional. Any long random text; used when hashing IP addresses for rate limiting. |

Only variables starting with `NEXT_PUBLIC_` reach the browser. The service-account key and the Resend key are read by server code only (the server modules are marked `server-only`, so the build fails if browser code ever imports them).

---

## 5. Set up email (Resend)

1. Create an account at [resend.com](https://resend.com).
2. **Domains → Add domain**, then add the DNS records it shows at your domain registrar. Wait until it says *Verified*.
3. **API Keys → Create API key** (sending access is enough). Put it in `RESEND_API_KEY`.
4. Set `EMAIL_FROM` to an address on the verified domain and `ORDER_NOTIFICATION_EMAIL` to your inbox.

What gets sent:

- **To you, on every new order:** reference, items and quantities, totals, customer name, phone, delivery area and address, the customer's note, and a link to the order in the admin.
- **To the customer,** only if they typed an email at checkout: a confirmation with the same order summary.
- **Sign-in links.** When Resend is configured the site sends a branded sign-in email itself. If it is not, the browser asks Firebase to send its plain built-in email instead (subject to Firebase's daily limit above).

If an email fails, **the order is never lost**. The failure is stored on the order, the dashboard shows an "Order emails that need attention" box, and the order page has a **Re-send notification email** button.

To use a different provider, replace the body of `sendEmail` in [src/server/email.ts](src/server/email.ts); nothing else talks to the provider.

---

## 6. Create the first admin

Admin access is a Firebase *custom claim* attached to the account by the server. It is not a password in the code, not a field in the database and not anything the browser can set.

**Option A — environment variable (easiest on Vercel)**

1. Set `ADMIN_EMAILS=you@example.com` (several emails: separate with commas).
2. Open `/sign-in`, enter that email and click the link that arrives.

Opening the emailed link proves you control the address; only then does the server grant the admin claim. You land on `/admin`.

**Option B — command line**

```bash
npm run admin:grant -- you@example.com
```

This uses the service-account key in `.env.local`. The person then signs in with the emailed link as usual.

**Option C — a separate admin account with a password (no email link needed)**

```bash
npm run admin:create -- admin@example.com
```

The command asks you to type a password twice (at least 12 characters; typing is hidden). The password is sent straight to Firebase: it is never written to a file, to the code or to an environment variable. The email does not have to be a real mailbox, but if it is not, nobody can receive a reset link for it — run the same command again to change the password.

Sign in on the **admin login page**: `/admin/login`, or `/<your ADMIN_PATH>/login` if you hid the admin address (below). The password is checked on the server, wrong attempts are limited (6 per email and 10 per network address every 15 minutes), a correct password on a non-admin account is refused, and every admin sign-in is written to *Amallar tarixi*.

If this password account should be the **only** admin, leave `ADMIN_EMAILS` empty and run `npm run admin:revoke` for any earlier admin email.

**Hiding the admin address**

Set `ADMIN_PATH` to a name that is hard to guess, for example `ADMIN_PATH=boshqaruv-7k2m9x4q` (8–64 lowercase letters, digits or hyphens). The admin area then lives at `/boshqaruv-7k2m9x4q` and its login at `/boshqaruv-7k2m9x4q/login`, while `/admin` answers "page not found". It is a server-only variable, so the name is not in the pages or scripts customers download. Set it in `.env.local` and on Vercel (then redeploy), and keep it out of anything public.

A hidden address is an extra layer, not the protection itself: every admin page and action still checks the admin session, exactly as before. Where this README says `/admin`, use your hidden address instead.

**Removing an admin**

```bash
npm run admin:revoke -- someone@example.com
```

Their sessions end immediately. Also remove the address from `ADMIN_EMAILS`, or it will be granted again the next time they sign in.

Anyone with access to the admin's mailbox can sign in as admin, so protect that mailbox with a strong password and two-step verification.

---

## 7. Deploy to Vercel

1. Push this repository to GitHub.
2. In [Vercel](https://vercel.com): **Add New → Project →** import the repository. The framework is detected automatically.
3. **Settings → Environment Variables:** add every variable from section 4 for *Production* (and *Preview* if you use it). For `FIREBASE_PRIVATE_KEY`, paste the key exactly as it appears in the JSON file (with `\n`), without surrounding quotes.
4. **Deploy.**
5. **Settings → Domains:** add `missnoza.com` and follow the DNS instructions.
6. Set `NEXT_PUBLIC_SITE_URL` to the final address and **redeploy** (environment changes only apply to new deployments).
7. Back in Firebase → Authentication → Settings → **Authorized domains**, make sure the final domain is listed.
8. Sign in with your admin email, add products, and place a test order.

Product photos are shrunk in the browser to under 1 MB before upload, well inside Vercel's request size limit.

---

## 8. Phone numbers: allowed regions and testing

The shop collects a phone number at checkout so you can confirm delivery. **No SMS is sent and phone numbers are not verified by code.** Customers verify their *email* (the sign-in link) if they choose to create an account.

**Allowed regions** are set in [src/config/site.ts](src/config/site.ts):

```ts
phone: {
  defaultCountry: "UZ",        // lets customers type a local number without +998
  allowedCountries: ["UZ"],    // [] = accept any valid international number
  example: "+998 90 123 45 67" // shown as a hint on the form
}
```

Use two-letter country codes, e.g. `["UZ", "KZ"]`. The rule is enforced on the server, and numbers are stored in international format (`+998901234567`).

**Test phone numbers:** any correctly formatted number for an allowed country works, for example `+998 90 123 45 67`. Nothing is sent to it.

The Firebase console's *SMS region policy* and *Phone numbers for testing* settings belong to Firebase **Phone** sign-in, which this site does not use, so there is nothing to configure there. If you add SMS verification later, enable the Phone provider in Firebase Authentication, restrict the SMS region policy to the countries you serve, and add test numbers on that same screen — SMS is billed per message.

---

## 9. Customising the shop

| To change | Edit |
| --- | --- |
| Brand name, tagline, **currency** (label and number style), time zone, phone region, order limits | [src/config/site.ts](src/config/site.ts) |
| Wording of any page (all text is Uzbek, written directly in the page files) | the page under `src/app/…` or the component under `src/components/…`; emails in [src/server/email.ts](src/server/email.ts) |
| Logo | replace `public/brand/logo.svg` |
| Home page picture | replace `public/brand/hero.svg` (or point `heroImage` at a photo) |
| Browser tab icon | replace `src/app/icon.svg` |
| Colours and fonts | the `@theme` block in [src/app/globals.css](src/app/globals.css); fonts in [src/app/layout.tsx](src/app/layout.tsx) |
| Home page wording | [src/app/(store)/page.tsx](<src/app/(store)/page.tsx>) |
| Privacy text | [src/app/(store)/privacy/page.tsx](<src/app/(store)/privacy/page.tsx>) — placeholder, not legal advice |
| Contact page wording | [src/app/(store)/contact/page.tsx](<src/app/(store)/contact/page.tsx>) |
| Delivery areas and fees, free-delivery threshold, contact details, announcement bar, notification email, pausing orders | **Admin → Sozlamalar** at `/admin/settings` (no code) |
| Products, prices, stock, photos, categories | **Admin** (no code) |

Placeholders you should replace before launch: the currency is set to **UZS** and the phone region to **Uzbekistan** as a guess — change them in `src/config/site.ts` if that is wrong, **before** entering real prices. Delivery areas, fees, phone, email and address are all placeholders, as are the sample products and their descriptions.

Prices are stored as whole numbers in the currency's smallest unit and shown as `185 000 soʻm`. The label, its position and the separators are set under `currency` in the config. For a currency with cents (USD, EUR) set `fractionDigits: 2`; the admin still types normal amounts like `12.50`.

The Uzbek wording was written by the developer tool, not a professional translator. Read through the shop once and adjust any phrase you would say differently.

Write product descriptions factually. The site does not add health or results claims, and neither should the product text.

---

## 10. How it works (data and security)

### Firestore collections

| Collection | Contents | Who can reach it |
| --- | --- | --- |
| `products` | Name, description, price, sale price, images, options (sizes/shades) with stock, visibility | Public may read visible products; writes are server-only |
| `productImages` | The uploaded photos themselves (one small record each), served at `/img/<id>` | Server only; anyone can view a photo through its `/img` address |
| `categories` | Name, slug, position | Public read; server-only writes |
| `orders` | Reference, status, items **with the price charged at the time**, totals, customer contact, address, notes, internal notes, status history, email delivery state | The customer's own account, and admins |
| `users` | A customer's saved name, phone, address | That customer only |
| `settings/store` | Delivery areas and fees, thresholds, contact details, notification email | Admins (the shop shows the public parts) |
| `auditLogs` | Who changed what and when | Admins, read-only |
| `rateLimits` | Hashed counters for abuse protection | Server only |

### Security model

- **The browser never writes to the database.** All reads and writes go through server code using the Firebase Admin SDK. The Firestore rules ([firestore.rules](firestore.rules)) lock down direct access as a second layer.
- **Prices and totals are computed on the server.** The cart only sends product IDs and quantities. The server recalculates the total from the database and rejects the order if it differs from what the customer was shown.
- **Stock cannot be oversold.** Checking stock, reducing it and saving the order happen in one database transaction.
- **No duplicate orders.** Each checkout attempt carries a one-time key; a double click or a retry returns the original order.
- **Sessions** are httpOnly cookies issued by Firebase and verified (including revocation) on every admin request. Signing out revokes existing sessions.
- **Every admin page, action and data function checks the admin claim itself** — hiding a link or guessing a URL does not help.
- **Abuse protection:** rate limits on sign-in emails (per address and per IP, with a 60-second resend cooldown), on sessions and on orders; a honeypot field on checkout; all input validated on the server with strict length limits.
- **Uploads** are accepted from admins only, checked by their actual file bytes (JPEG/PNG/WebP), limited to 900 KB and stored under random IDs.
- **Stale admin edits are refused.** If an order reduces a product's stock while its edit form is open, saving asks you to reload instead of overwriting the newer number.
- **Cancelling an order** returns its items to stock exactly once; re-opening it takes them out again.
- **Security headers** (no framing, no MIME sniffing, HTTPS-only, restricted form targets) are set in [next.config.ts](next.config.ts).

### Things to know

- **Order confirmation links** (`/order/<long-random-id>`) can be opened by anyone who has the link, so that guests can see their confirmation. The page shows the items and total but not the address or full phone number.
- **Personal data kept:** name, phone, address, optional email, and the order. IP addresses are not stored (only a salted hash, briefly, for rate limiting).
- **Revenue on the dashboard** counts every order that is not cancelled, in the shop's time zone (`timeZone` in the config).
- **Catalogue freshness:** shop pages are cached for speed. Admin changes appear immediately; stock changes caused by orders appear within about five minutes (immediately when an item is running low). The final stock check always happens at the moment of ordering.
- **Unused photos:** a photo uploaded but never saved with a product stays in the `productImages` collection until you delete it in the Firebase console. Photos of deleted or edited products are removed automatically.
- **Rate-limit records** clean themselves up after each order; nothing to configure.
- **Search** runs over the catalogue in memory, which suits a shop of up to a few thousand products.

---

## What has been checked

Tested locally with a production build against the Firebase emulators and a mock email server, driving a real browser. The full run (87 checks, all passing) was done on the English version, before translation; it covers everything in the list below. After the translation to Uzbek a shorter run (20 checks, all passing) repeated the main paths: browsing and search, a complete order, both emails, admin sign-in, an order status change, saving the shop details in Sozlamalar, creating a product with a photo, and phone layouts. The browser test scripts were one-offs and are not part of this repository; the security-rule tests are.

- Browsing, search, category filter, sorting, sale filter, empty states, sold-out options.
- Cart, checkout validation, the total shown before submitting, order confirmation and reference.
- Order saved with server-side prices; stock reduced; cart cleared.
- A replayed request does not create a second order; a forged total, an over-stock quantity, an unknown delivery area and a bot (honeypot) submission are all rejected; the order endpoint is rate limited.
- Owner and customer emails are sent with the right content, and customer text is escaped; when the provider fails the order is kept, the failure is shown, and re-sending works.
- Signed-out visitors, forged cookies and ordinary customers cannot open any `/admin` page; a used sign-in link cannot be reused; signing out and revoking admin end the session at once.
- Customers see only their own orders and profile.
- Admin: dashboard figures and date filter, order search and filters, status changes, internal notes, stock return on cancel, product create/edit/hide/delete with photo upload (a 13 MB test photo was shrunk, stored and served correctly), option (shade) editing, stale-edit protection, settings, categories, activity log.
- Phone and desktop layouts (no sideways scrolling on a 390 px screen).
- `npm run test:rules`: 46 security-rule tests covering what a browser can and cannot do directly against the database.

**Not checked** (needs your accounts): a live Firebase project and its real free-plan limits, real email delivery through Resend, Firebase's own sign-in email, the Vercel deployment, your DNS, and behaviour under real traffic.

---

## Go-live checklist

- [ ] Firebase project created (free Spark plan), Firestore database created
- [ ] Email link sign-in enabled; production domain in *Authorized domains*
- [ ] `npm run firebase:deploy` run (rules + indexes), indexes finished building
- [ ] All environment variables set in Vercel; no emulator variables
- [ ] Resend domain verified; a real order email received in your inbox
- [ ] Signed in as admin on the live site; a second, non-admin email confirmed to be refused at `/admin`
- [ ] Currency, phone region and time zone correct in `src/config/site.ts`
- [ ] Sample products removed; real products, prices, stock and photos entered
- [ ] Delivery areas, fees and contact details set in Admin → Sozlamalar (`/admin/settings`)
- [ ] Uzbek wording read through and adjusted where needed
- [ ] Privacy page text replaced with your own
- [ ] Logo, hero image and icon replaced
- [ ] One full test order placed on a phone on the live site, then cancelled in the admin
