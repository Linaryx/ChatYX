# Licensing

## Project License

Effective with the maintainer-approved licensing change of 2026-09-05, ChatYX
is free software: you can redistribute it and/or modify it under the terms of
the GNU General Public License as published by the Free Software Foundation,
version 3 only (`GPL-3.0-only`). See the complete, unmodified [LICENSE](../LICENSE).
The generic "or any later version" example at the end of that license text is
not ChatYX's license grant.

This applies to ChatYX's first-party source, including `src/`,
`services/youtube-websocket/`, scripts, tests, configuration and documentation,
except material with its own license or retained third-party notices. It does
not assert ownership of, or replace the licenses on, third-party material.
ChatYX is distributed WITHOUT ANY WARRANTY, including the implied warranties
of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE; see GPL sections 15-17.

## MIT History And Attribution

The previous project notice, **Copyright (c) 2025 Linaryx**, and its complete
MIT permission notice and disclaimer are preserved verbatim in
[LICENSE-MIT](../LICENSE-MIT). Keep that notice with copies or substantial
portions of the legacy MIT material, including when included in a GPL work.
MIT-covered material can be incorporated into a GPLv3-covered work while
retaining its notices. This transition does not revoke earlier MIT grants,
rewrite historical releases, or offer new GPL-only contributions under MIT.

The review baseline is ChatYX commit
`406f8a6165059ab38bdfab86643eb4ec933d07d9`, whose root license was MIT. Git author
records list Linaryx (77 commits). These are attribution records, not proof of
exclusive ownership or copyright assignments. A notice scan found no additional explicit
third-party copyright/license headers in tracked application files; that is
not proof that all historical code or assets were independently authored.
Retain any existing or subsequently identified upstream notices and resolve
unclear provenance before importing or distributing the affected material.

## Dependencies, Services And Media

Dependencies, including code bundled into browser JavaScript or container
images, retain their upstream copyright, license and NOTICE requirements.
`package.json`, workspace manifests and `bun.lock` identify packages/versions,
not a blanket GPL grant for those packages. Preserve the actual license texts,
required notices and any source obligations of the components shipped in each
artifact. Review transitive dependencies and separately licensed assets too;
this change is not a completed dependency or release-artifact license audit.

External APIs and hosted services (including Twitch, YouTube, 7TV, BetterTTV,
FrankerFaceZ, RTE and TTS providers) have separate access, privacy and service
terms. Calling them does not relicense their implementations. Emotes, badges,
fonts, emoji artwork, logos and user-supplied media retain their own rights;
an API URL or an upstream application's GPL license is not permission to
redistribute all its media. Separately distributed independent works retain
their licenses; GPL's combined-work rules still apply where relevant.

## Distribution Checklist

- Include `LICENSE`, the applicable legacy `LICENSE-MIT`, and all required
  third-party notices with source and non-source distributions.
- Preserve copyright, license and warranty notices; prominently identify
  modifications and their dates, and license the covered combined work under
  GPLv3 as required by sections 4-5. Honor applicable interactive-interface
  legal notices under section 5(d), including its existing-interface exception.
- When conveying builds (including minified browser JavaScript and distributed
  container images), provide the matching machine-readable Corresponding
  Source under section 6: preferred editable source, relevant dependency
  source, build/install scripts and configuration, subject to the section 1
  exclusions. A lockfile or link to a moving default branch alone is not a
  substitute for complete source corresponding to the distributed version.
- For downloads, section 6(d) permits equivalent source access at no further
  charge, with clear directions next to the build if source is on another
  server. Keep that source available as required; provide Installation
  Information for User Products where section 6 requires it.
- Merely running a GPL service without conveying copies does not by itself
  require publishing server modifications. Serving browser JavaScript does
  convey copies. Ordinary GPL is not AGPL's remote-network source requirement.

Release follow-up: this licensing-only change does not alter the build,
deployment, Docker packaging or UI. Before distributing a GPL-labelled build,
verify that each artifact carries its notices and has a matching source-access
path; the repository license change alone does not implement those steps.

## Reference Provenance

[CHAT_REFERENCES.md](CHAT_REFERENCES.md#local-codesnippets-provenance) records the
local checkouts, full upstream revisions and licensing evidence. `codesnippets/`
is ignored and untracked in ChatYX; it is not a dependency or release payload.
This licensing change imports no reference application code or assets and does
not certify historical derivation. The reference policy requires per-file
compatibility checks and provenance/notice records for any future import.
AGPL, custom/nonfree and unknown-license references remain excluded from code
imports under that policy; GPLv3 adoption is not permission to strip their terms.

## Official Guidance

- [GNU: applying the GPL and explicit project notices](https://www.gnu.org/licenses/gpl-howto.html).
- [GNU: MIT/Expat is GPL-compatible](https://www.gnu.org/licenses/license-list.html#Expat).
- [GNU: meaning of GPL compatibility](https://www.gnu.org/licenses/gpl-faq.html#WhatDoesCompatMean).
- [GNU: GPLv2-only versus GPLv3](https://www.gnu.org/licenses/gpl-faq.html#v2v3Compatibility).
- [GNU: combining GPLv3 and AGPLv3](https://www.gnu.org/licenses/gpl-faq.html#AGPLGPL).
- [Official GPLv3 text](https://www.gnu.org/licenses/gpl-3.0.txt), especially sections 1, 4-7 and 13.

This is a project policy and compliance summary, not legal advice or additional
restrictions on recipients' rights under the applicable licenses.
