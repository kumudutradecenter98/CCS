# Customer Collection System — Online (Vercel + MongoDB Atlas)

This project keeps the existing Customer Collection System UI and connects persistence to a Vercel API backed by MongoDB Atlas. Passwords are hashed with bcrypt and the login session is held in an HttpOnly cookie. The browser never receives stored password hashes through the normal data API.

## Important before using it

- This is a deployment project, not a live hosted website. It becomes online only after you configure Atlas/Vercel and deploy it.
- Do not commit `database.json`, backups, `.env` files, MongoDB connection strings, or `SESSION_SECRET` to GitHub.
- The app's existing features are retained in the original HTML as far as possible, but a major data-storage/authentication conversion needs real testing against your actual database and each Admin/Staff workflow before relying on it for business records.
- Online accounts always require a password. The old local-only option to bypass Staff password login is disabled for security.
- Only use a trusted admin device to download full database backups: the backup includes password hashes. Keep it private.

## 1. Create a MongoDB Atlas database

1. Create a MongoDB Atlas project and cluster.
2. Create a database user with a strong password. This is a database account, not your app's Admin login.
3. In Atlas Network Access, allow connections from Vercel. For initial testing, Atlas may require a broad allow-list entry because Vercel serverless egress IPs can vary; this is less restrictive, so use Atlas/Vercel's current networking guidance or a private-network option if available.
4. Copy the Atlas connection string. URL-encode special characters in the database user's password.

## 2. Import the current `database.json`

Keep the current local HTML and `database.json` unchanged as a safety backup.

On a computer with Node.js 20 or newer:

```bash
npm install
```

Set `MONGODB_URI` and optionally `MONGODB_DB` in the terminal environment, then run:

```bash
npm run import-db -- "C:/path/to/database.json"
```

On macOS/Linux, use the appropriate path, for example `./database.json`. The import script checks for an Admin account, preserves the data arrays, and converts plaintext passwords from the JSON into bcrypt hashes before writing to Atlas. Do not run the import repeatedly after staff start making online changes, because importing again replaces the main database document with the file's contents.

Example PowerShell session:

```powershell
$env:MONGODB_URI="mongodb+srv://..."
$env:MONGODB_DB="customer_collection_system"
npm install
npm run import-db -- "D:\CustomerSystem\database.json"
```

## 3. Put the project on GitHub

1. Create a **private** GitHub repository.
2. Upload the project files: `index.html`, `api/`, `scripts/`, `package.json`, `package-lock.json` (created by `npm install`), `vercel.json`, and `README.md`.
3. Do **not** upload `database.json`, backups, or environment files.

## 4. Deploy to Vercel

1. In Vercel, choose **Add New → Project** and import the private GitHub repository.
2. Use the project root as the Root Directory. Vercel should detect the Node project; no frontend build command is required.
3. In Project Settings → Environment Variables, add:
   - `MONGODB_URI` — the Atlas connection string
   - `MONGODB_DB` — `customer_collection_system` (or your chosen DB name)
   - `SESSION_SECRET` — a unique random string of at least 32 characters
4. Apply the variables to Production (and Preview only if you intentionally use Preview with the same database).
5. Deploy, then test the `/api/admin/bootstrap-status` endpoint. It should report `needsImport: false` after successful migration.

To generate a secret locally with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

## 5. First verification checklist

- Sign in with the Admin username/password from the original database (the migration hashes the password but does not change it).
- Confirm expected customers, visits, departures, reminders, reports and staff appear.
- Create a test Staff account and test it in a separate browser/private window.
- Confirm Staff cannot see other Staff records or Admin-only sections.
- Test visit/departure create, edit, soft-delete, due-date reminder completion, reports, backup and restore.
- Test from PC and phone. Do not retire the original local system until these checks pass.

## API overview

- `POST /api/auth/login` — authenticate and issue an HttpOnly session cookie
- `GET /api/auth/session` — restore the current session
- `POST /api/auth/logout` — clear session
- `POST /api/auth/verify-password` — verify current user's password server-side
- `POST /api/auth/change-password` — change current user's password
- `GET/PUT /api/data` — read/write data with server-side Admin/Staff filtering
- `GET /api/admin/backup` — Admin-only full backup
- `POST /api/admin/restore` — Admin-only full restore

## Known deployment limitations

The project has not been connected to your private GitHub, Vercel or MongoDB accounts from this chat, and no live deployment has been performed. You must configure those services and run the test checklist before using this for real collections. The existing frontend was originally designed around a single editable local database object, so the converted API and permission rules require end-to-end testing of all record mutation and backup/merge flows before production use.
