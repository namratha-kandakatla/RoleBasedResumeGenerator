# GitHub Copilot Instructions

This project is a static browser app. Keep changes scoped to the existing files unless a new file is clearly needed.

## Product Rules

- Preserve the uploaded resume template as the base document.
- Replace only marked placeholders such as `[Insert Job Title Here]`, `[Insert Skill Matrix Here]`, and `[Insert Bullet points Here]`.
- Do not flatten project bullet points into one paragraph.
- When exporting from a DOCX template, keep generated project points under the exact placeholder where they belong.
- Keep generated responsibilities aligned with the target role, job description, years of experience, and project domain.
- Do not hard-code one technology stack for every role.

## Code Style

- Use plain JavaScript, HTML, and CSS.
- Do not add build tooling unless the project is intentionally migrated to a framework.
- Keep browser-only file handling local; do not upload user resumes or job descriptions to a server.
- Keep UI changes separate from resume-generation logic when possible.

## Testing Focus

- Test resume generation after changing `app.js`.
- Test DOCX template upload and download after changing template replacement logic.
- Confirm project placeholders are replaced sequentially and remain in the uploaded template structure.
