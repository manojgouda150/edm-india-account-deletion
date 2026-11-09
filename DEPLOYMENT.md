# EDM India Account Deletion Pages package

This repository-root package contains only the prepared static site, its SPA
fallback, and a GitHub Actions workflow that deploys the `site/` directory.
The workflow does not build application source and cannot publish the main EDM
India dashboard.

Target project Pages URL:

`https://manojgouda150.github.io/edm-india-account-deletion/delete-account`

The site uses the existing EDM India account deletion page and calls the
existing API at `https://edm-india-api-test.onrender.com`. It contains no
Firebase Admin credentials, lifecycle token key, Resend key, or other server
credentials. Firebase Web app configuration is public browser configuration
and is bundled into the static JavaScript because Firebase Authentication
requires it in the browser.

Before publishing, copy this package's contents into the root of the dedicated
repository without overwriting any existing files. Enable GitHub Pages with
**GitHub Actions** as the deployment source. The workflow publishes only
`site/`.

Before production use, verify Firebase Authentication's authorized domain and
the API's exact CORS allowlist. Configure the API's `EDM_PUBLIC_APP_BASE_URL`
to the target `/delete-account` URL so email action links return to this page.
