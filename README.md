# Smart Student Attendance Management System
Static app (HTML/CSS/ES modules) for GitHub Pages. Two modes:
- **Local demo** (default): IndexedDB in this browser only. Use Settings > Export backup.
- **Cloud**: Supabase with login + row-level security.

## Supabase setup
1. Create a project; run `sql/schema.sql` in the SQL editor.
2. Auth > Users: add each instructor; then `insert into instructors values('<user uuid>');`. Disable public sign-ups.
3. Put the project URL and **anon** key in `js/config.js`. Never use the service_role key.

## GitHub Pages
Push to a repo > Settings > Pages > deploy from `main` / root. Do not commit real student data.

## Excel import
Columns: `Student ID` (optional), `Name`/`الاسم`. Sheets named like a department are auto-assigned; others use the selected department.
