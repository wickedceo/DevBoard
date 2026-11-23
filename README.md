# DevBoard

DevBoard is a React 19, TypeScript and Vite project workspace backed by Supabase. It includes account authentication, project and task management, a deadline calendar, a personal team directory, in-app notifications and account settings.

## Requirements

- Node.js 24 or newer (the test command uses Node's built-in TypeScript stripping)
- npm
- A Supabase project with the application tables and user-scoped Row Level Security policies

## Local development

1. Install dependencies with `npm ci`.
2. Copy `.env.example` to `.env.local`.
3. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to the project's Supabase URL and publishable/anon key. Never put a service-role key in the frontend.
4. Start the development server with `npm run dev`.

The app displays a configuration error when either Supabase variable is missing. Do not use production credentials in a shared development environment.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start Vite for local development |
| `npm test` | Run date and dashboard metric unit tests |
| `npm run lint` | Run ESLint |
| `npm run build` | Type-check and create the production bundle |
| `npm run preview` | Preview the production bundle locally |

## Database and migration

The application uses five existing tables: `projects`, `tasks`, `team_members`, `notifications` and `user_settings`. The repository does not contain a complete baseline schema, so these migration files cannot provision a fresh database by themselves.

### Recovered database state

The current recovered Supabase database already has all five tables. Both migrations below were applied manually through the Supabase SQL Editor:

- `20261122213000_add_descriptions_archives_and_completion_history.sql` was applied, and its added columns were verified in the live database.
- `20261122223040_enforce_owner_row_level_security.sql` was applied. All five restrictive ownership guards were verified in `pg_policies`. The four existing `notifications` policies were changed to target `authenticated` and verified. Existing owner-based permissive policies were preserved.

No Supabase migration history table was found. The manual SQL applications are therefore not recorded as applied migrations by Supabase's migration tracking. Supabase CLI is not installed in this Codespace. Do not infer migration history or deployment state from the filenames alone.

### Prerequisites and migration order

For a fresh database, first provision the full baseline schema from a separately maintained and reviewed source. Before applying these migrations, that baseline must include the five tables, their required existing columns (including ownership and task/project identifiers), enabled RLS, and the named owner-based permissive policies. The second migration also expects the four named Notifications policies to exist. These prerequisites are not defined by the migrations in this repository.

Apply migrations in timestamp order:

1. Back up the target database, review the SQL, and verify the baseline schema, policies and existing task/project ownership relationships.
2. Apply `20261122213000_add_descriptions_archives_and_completion_history.sql`. It adds project and task descriptions, `projects.archived_at`, and `tasks.completed_at`; it does not drop records or alter RLS policies.
3. Apply `20261122223040_enforce_owner_row_level_security.sql` only to a database with the existing DevBoard policy setup. It changes the four named Notifications policies to `authenticated` and adds restrictive owner guards for all five tables. It does not create permissive owner-access policies, disable RLS, or inspect or repair existing rows. The task guard requires a linked project to belong to the same user. `user_settings` has existing owner-based SELECT, INSERT and UPDATE policies but no DELETE policy; the restrictive guard does not grant permissions by itself.
4. Verify the added columns and policy definitions in `pg_policies`, test access with separate accounts, and then deploy the frontend with its environment variables configured.

The first migration does not fabricate completion timestamps for existing completed tasks; the completion trend starts accumulating as tasks are completed after the column is available. The second migration is not a standalone security or schema baseline and assumes the named policies and tables already exist.

## Deployment

Build with `npm run build` and publish the generated `dist/` directory to a static host. Configure `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as build-time environment variables. Configure the host to serve `index.html` for client-side routes such as `/projects/123`, and use HTTPS. Configure Supabase Auth's allowed site and redirect URLs for the deployed domain.

For each target environment, verify authenticated access and RLS behavior using separate test accounts before deployment. The recovered database state described above was verified manually; no production frontend deployment was performed by this repository workflow.

## Supported scope and limitations

- Projects and tasks are user-owned records. Task assignment and shared project membership are not supported by the present schema.
- Team entries are private directory contacts; they do not create accounts, grant access or send invitations.
- Notifications are persisted in the in-app inbox. Email and push delivery are not configured.
- Theme selection is not persisted; the interface uses its dark visual theme.
- Browser-local legacy records without account ownership are not imported into signed-in accounts. The app leaves those browser records untouched to avoid associating one user's data with another account on a shared browser.
