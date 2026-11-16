# Media storage and processing

Media bytes and metadata live in the `lamsechi` MongoDB database in the `media.files` and `media.chunks` GridFS collections. No object storage is required. Upload and retrieval endpoints currently require an admin session; no public media route or publication mechanism is provided yet. Task 12 will build the admin library and upload interface, and catalog tasks must establish an explicit public/private policy before exposing files. URLs should be treated as private, not as authorization tokens.

## Accepted files and limits

- JPEG, PNG and static WebP are limited to 10 MiB input and output and 40 million input pixels. The server checks the declared type against magic bytes, decodes the image using Sharp, applies EXIF orientation, removes embedded metadata, resizes within 2400 × 2400 without enlargement, and encodes actual WebP at quality 82. Animated/multipage images, SVG and other formats are rejected. The original uploaded image bytes are not retained.
- Non-fragmented MP4 with one H.264/AVC video track is limited to 25 MiB, 3840 × 2160 and five minutes. The input is retained as MP4; video is never converted to WebP. The service checks the file signature, top-level box boundaries, required `ftyp`, `moov`, and nonempty `mdat` boxes, and parsed movie/track metadata. **This is container validation, not a full video decode or malware scan:** corrupt or malicious codec payloads can still pass, and playback is not guaranteed. Keep videos private until an approved decoding/scanning pipeline and publication policy are established. Other video containers and codecs are rejected.
- Uploads are buffered in process memory after a streaming byte limit, and image decoding uses additional memory. Configure reverse-proxy body size, request timeouts and concurrent-upload limits suitable for the host; enforce production abuse controls before exposing uploads broadly. Metadata is limited to normalized safe filename, detected content type, kind, dimensions, byte length and upload timestamp. Filenames are not filesystem paths and are never used directly in response headers.

## API and security

`POST /api/admin/media` accepts one raw binary body, an exact allowed `Content-Type`, and optional percent-encoded `X-File-Name`. It requires an admin session and an `Origin` matching `APP_ORIGIN`. It checks authorization before reading the body, rejects oversized data while reading, and responds with the generated ID and safe metadata. Set `APP_ORIGIN` to the correct public origin and use HTTPS in production. No multipart form upload is implemented in this foundation.

`GET /api/admin/media/{id}` requires an admin session, serves only stored WebP or MP4 with `nosniff`, a restrictive content security policy, `private, no-store` and an ID-based safe filename. Single byte ranges are supported for video playback; invalid ranges return 416. There is no unauthenticated or customer retrieval and no implicit public caching. Media is immutable by ID in this task; do not add public caching until visibility and revocation are designed.

## Failed and orphaned uploads

GridFS splits each upload into chunks and creates a file record after completion. Failed writes attempt an immediate abort; a process crash or database outage can leave chunks without a file record. No finished media or possibly referenced asset is automatically deleted. Run `npm run media:audit` to count possible orphaned upload IDs older than 24 hours; it is **read-only** and does not print file contents or delete anything. The age is based on the generated GridFS ObjectId, and candidates are not proof that an upload is abandoned.

For cleanup, first back up the database, stop or otherwise quiesce uploads across all application instances, review candidate IDs and verify they have no matching `media.files` record. Only a separately authorized operator should remove confirmed orphan chunks, after which re-run the audit. Never delete completed files based on age or apparent lack of references; later catalog, content and order features must define reference tracking and safe deletion first. The application has no automatic production deletion or destructive cleanup command. Monitor orphan counts, database capacity and backup/restore for both GridFS collections.

## Verification

`npm run test:integration` runs isolated MongoDB tests for image type/size and decode failures, actual WebP output and dimensions, MP4 container restrictions, filename normalization, read-only orphan audit, admin-only HTTP access, range requests and bytes/metadata surviving a MongoDB restart. The test MP4 is a synthetic red 32 × 32 clip generated locally for the suite. The tests do not prove every possible corrupt video bitstream will be rejected.
