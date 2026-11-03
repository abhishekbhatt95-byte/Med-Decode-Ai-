# MedDecode AI Phase 3 PostgreSQL RLS fixtures

These SQL files are proposals for **manual execution only**. Maven does not run them. They do not create Supabase Auth users, policies, grants, roles, migrations, or Storage objects.

## Target and safety

- Disposable Supabase project ref: `qcxbtqhfhcuciwtlihjn`.
- Open the project dashboard and verify the ref in the URL before opening SQL Editor.
- Run setup and cleanup as `postgres` in the `postgres` database, using only synthetic data.
- Never run these files in the production project.
- The setup guard confirms the SQL Editor role/database, checks both Auth users and their `public.profiles` rows, and refuses fixture-ID collisions.
- The cleanup script deletes only the two exact document IDs when both owner UUID and synthetic `file_path` marker match. Existing foreign keys cascade to the synthetic analyses, extracted text, medicines, confidence scores, and review flags. It never deletes Auth users or profiles.

## Prepare identities and UUIDs

1. In the disposable project's Authentication dashboard, create two dedicated test users (User A and User B). Do not use real people or real medical data.
2. Obtain real Supabase-issued access tokens for those users through the existing app/client login flow. The token `sub` claim identifies each Auth UUID. Do not fabricate JWTs.
3. Create an anonymous Auth session in the disposable project through the Supabase Auth client (`signInAnonymously`) and obtain its real access token. If anonymous sign-in is disabled, enable it only in this disposable project.
4. Generate four fresh UUIDs locally for `__DOCUMENT_A_UUID__`, `__DOCUMENT_B_UUID__`, `__ANALYSIS_A_UUID__`, and `__ANALYSIS_B_UUID__`. PowerShell: `[guid]::NewGuid().ToString()`.
5. Replace all six placeholders in `rls-test-fixtures-setup.sql` with the User A/B Auth UUIDs and the four new fixture UUIDs. Keep the surrounding SQL quotes.
6. Review the selected Supabase Dashboard project one more time, then manually run the setup SQL in that project's SQL Editor.
7. Set `MEDDECODE_RLS_ANALYSIS_A_ID` and `MEDDECODE_RLS_ANALYSIS_B_ID` to the exact UUIDs used in the setup SQL. Use the three real access tokens as local environment variables. Never paste access tokens or passwords into chat, source files, or Git.

## Test execution

From `backend`, with the `MEDDECODE_RLS_*` variables configured locally:

```powershell
.\mvnw.cmd -Dmeddecode.rls.integration=true -Dtest=PostgresRlsIntegrationTest test
```

The test class uses the production JWT decoder/JWKS validation path, a Session Pooler JDBC URL, the project-scoped `meddecode_backend` login, and the one-connection Hikari profile. It does not use `service_role` for user requests. The database fixtures are created beforehand by the SQL Editor as `postgres` because the application role intentionally has no user-facing INSERT policy for `analyses` or the related derived tables.

## Cleanup

After reviewing the test output, replace the same six placeholders in `rls-test-fixtures-cleanup.sql` and run it manually in the same disposable project's SQL Editor as `postgres`. The two parent-document deletes cascade to all fixture children. If a document ID exists with a different owner or `file_path`, cleanup aborts instead of deleting it.

## Coverage matrix

| Table / surface | Identity | Operation | Expected result | Interpretation |
|---|---|---|---|---|
| `documents` | User A / User B | SELECT own fixture | One row | Own-row RLS allow |
| `documents` | User A / User B | SELECT other user's fixture | Zero rows | RLS silently filters |
| `documents` | User A | INSERT with User B as owner | SQLSTATE `42501`, row-level-security message | RLS `WITH CHECK` denial |
| `documents` | User A | UPDATE own document owner to User B | SQLSTATE `42501`, row-level-security message | RLS `WITH CHECK` denial on the new row |
| `documents` | User A / User B | UPDATE or DELETE other user's row | Zero affected rows | RLS silently filters |
| `analyses` | User A / User B | SELECT own / other analysis | One / zero rows | Parent-document ownership RLS |
| `analyses` | Authenticated user | INSERT / UPDATE / DELETE | INSERT RLS error; UPDATE/DELETE zero rows | No write policies; existing table ACLs allow the statement to reach RLS |
| `extracted_text` | User A / User B | SELECT own / other derived row | One / zero rows | Document-owner RLS |
| `extracted_text` | Authenticated user | INSERT / UPDATE / DELETE | INSERT RLS error; UPDATE/DELETE zero rows | SELECT-only RLS policy with existing table ACLs |
| `medicines` | User A / User B | SELECT own / other derived row | One / zero rows | Ownership inherited through RLS on `analyses` and `documents` |
| `medicines` | Authenticated user | INSERT / UPDATE / DELETE | INSERT RLS error; UPDATE/DELETE zero rows | SELECT-only RLS policy with existing table ACLs |
| `confidence_scores` | User A / User B | SELECT own / other score | One / zero rows | `authenticated` SELECT grant plus owner RLS policy |
| `confidence_scores` | Authenticated user | INSERT / UPDATE / DELETE | SQLSTATE `42501`, permission-denied message | Table ACL denial before row filtering |
| `confidence_scores` | `anon` role | SELECT | SQLSTATE `42501`, permission-denied message | No table SELECT grant |
| `review_flags` | Authenticated / anonymous Auth / `anon` | SELECT, INSERT, UPDATE, DELETE | SQLSTATE `42501`, permission-denied message | No ordinary-role ACL; not a zero-row RLS result |
| `documents`, `analyses`, `extracted_text`, `medicines` | Unauthenticated `anon` role | SELECT private fixture | Zero rows | RLS silently filters because `auth.uid()` is NULL |
| `documents` | Anonymous Supabase Auth user | SELECT own / User A document | One / zero rows | JWT has `is_anonymous=true`, DB role `authenticated`, UID-bound RLS |
| Transaction-local claims | User A → User B → anonymous Auth | Read `auth.uid()`, `auth.role()`, current role | Matches each verified JWT | RLS context set per transaction |
| Hikari pool | User A → User B → anon | Reuse physical backend PID; inspect after commit/rollback | Same PID; login role and claim GUCs restored | Transaction-local cleanup / no identity leakage |
| Invalid/missing identity | Mismatched or no principal | Attempt database operation | Fail closed before business SQL proceeds | Security-context validation |

Important distinction: a `SELECT` that returns zero rows is not the same as a permission failure. Tests assert both outcomes separately. The `review_flags` and `confidence_scores` negative-write cases expect ACL-level permission errors; the SELECT-only `analyses`, `extracted_text`, and `medicines` tables expect row-level-security denial/filtering where the existing ACL grants allow the SQL operation to reach RLS.
