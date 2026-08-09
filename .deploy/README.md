# VPS connection config

Local VPS connection details live in `.deploy/vps.local.env`.

That file is intentionally ignored by Git. It should contain only connection
metadata such as SSH target, port, app directory, branch, and health URL. Do not
store root passwords, private keys, access tokens, or database passwords here.

This project uses the local machine's existing SSH key/agent for VPS access.
When asked to update/check the VPS, read `.deploy/vps.local.env` first.
