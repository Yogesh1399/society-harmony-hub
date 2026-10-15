# Society Harmony Hub — working agreements

Multi-tenant co-operative housing society management SaaS.
Live at `society.gaugecalpro.com`.

These are decisions already taken. Follow them rather than re-deriving them.

## Where things are

| | |
|---|---|
| Latest code | GitHub `Yogesh1399/society-harmony-hub`, branch **`v7-latest`** |
| Stale — do not use | branch `master`; repo `society-web`; the Lovable copy (frozen 2 May 2026) |
| Supabase project | **`ekhonguhgkzaactbxnil`** (Society_Webswam). The value `kaqxgucpfqaisoqpfqoz` that appeared in an old `.env` is wrong — logins fail against it |
| PHP side (Hostinger) | app root `/home/u344512311/domains/gaugecalpro.com/`; the society app is a **subdomain**, docroot `public_html/society/`, so its endpoints live in `public_html/society/api/` |

## Architecture — plan A

Supabase holds the **database only**. Hostinger PHP handles file storage,
email, notifications and cron. Files are stored outside the webroot with
random names; `documents.file_url` holds a `php://<relative path>` marker.
`upload.php` and `file.php` verify the caller's Supabase token and use
**that token** for every DB call, so RLS does the enforcing and no
service-role key is needed anywhere in PHP.

MySQL is wanted eventually; nothing has moved yet.

## Permissions — the rule that matters

**The database is the gate. The UI only mirrors it.**

Two SQL functions decide every write:

```
can_write_society(society_id)   super admin, society admin, or ANY active
                                committee member — from user_roles OR
                                from committee_members
can_manage_finance(society_id)  super admin, society admin, or an active
                                office bearer (chairman/secretary/treasurer)
```

`can_manage_finance` is a strict subset of `can_write_society`: being
allowed to touch money always implies being allowed to touch records,
never the reverse.

`src/hooks/useAccess.ts` mirrors those two functions and is the **only**
place the frontend decides permissions. The sidebar, `RequireModule` and
every page's action buttons read from it.

- Change one of those SQL functions → change `useAccess.ts` in the same commit.
- Never put a role check straight into a page. Add it to `useAccess`.
- `DEFAULT_VIEW` in `useAccess.ts` is the single definition of what each
  role sees before a society configures permission groups. The sidebar and
  the route gate both read it, so a link and its page cannot disagree.

Never write an RLS policy on `has_society_access()` for INSERT / UPDATE /
DELETE / ALL. That function only asks *"is this user in this society?"* —
a tenant satisfies it. It is for SELECT only.

Remember that RLS policies are **permissive**: they are OR-ed. A tight
policy does not cancel a loose one sitting beside it on the same table.

## Deploying — the .htaccess trap

`public/.htaccess` is what makes refreshing on `/income` work. Without it
every deep route 404s on refresh while the home page still loads fine —
that exact symptom means the rewrite is not being applied, not that the
app is broken.

It is a hidden file, so it disappears easily during upload or zip
extraction. After every deploy:

1. Turn on **show hidden files** in the Hostinger File Manager and
   confirm `.htaccess` is in `public_html/society/`.
2. Or open `https://society.gaugecalpro.com/.htaccess` in a browser —
   **403 Forbidden means it exists** (Apache protects it); **404 means it
   is missing**.

Only `[L]` and `[QSA,L]` style flags are valid. There is no `Q` flag —
`[QL]` is a syntax error and takes the whole site down with a 500.

`index.html` must be served with `no-cache`, hashed assets with a long
cache. Otherwise the browser keeps running the previous build after a
deploy and you debug bugs that are already fixed.

## Fiscal year

Indian financial year, **April to March**. Screens must take their default
period from the society's open fiscal year via `src/hooks/useFiscalPeriod.ts`
— never from `new Date()`. Only FY 2023-24 is open on the demo society;
defaulting to today lands the user on an empty 2026 and forces them to
change dates by hand.

## Privacy rule — no exceptions

The owner's personal name, personal email and personal mobile number must
not appear anywhere in the application, in seed data, in test users or in
sample records. Only the official business email may be referenced.

## Known schema drift

Several columns exist in the live database but not in `supabase/migrations/`.
**Query the live schema before writing code against a column** — do not
assume the migrations describe reality:

`maintenance_settings.owner_occupied_amount` / `rented_flat_amount` /
`per_sqft_rate` / `calculation_basis` · `members.maintenance_amount` /
`is_owner` / `self_occupied` / `maintenance_note` · `flats.expected_rent` /
`deposit_amount` · `maintenance_bills.bill_year` / `bill_month_num` ·
`complaints.photo_urls` / `resolution_notes` / `closed_at` ·
`notices.attachment_url`

## Checks before handing anything over

```bash
npx tsc --noEmit     # must be clean
npx vitest run       # must be green
npm run build        # must succeed
```

`src/hooks/useAccess.test.tsx` encodes the permission model as tests — a
flat member must not be able to write anything, a plain committee member
must not touch money, an office bearer recorded only in
`committee_members` must still count as an office bearer. If a change
makes one of those fail, the change is wrong, not the test.
