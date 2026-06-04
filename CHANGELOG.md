# Changelog

## [1.9.3] - 2026-06-04

### Added
- **Zebra Scanner REST API**: Created secure endpoints `/api/scanner/part` (UPC-based part lookup) and `/api/scanner/adjust` (stock level updates) supporting HTTP Basic Authentication.
- **Middleware Integration**: Excluded scanner-specific routes from standard NextAuth session redirection to allow custom stateless client authentication.

## [1.9.2] - 2026-05-28

### Added
- **Transformer and PCB Schematic Icons**: Added custom-designed vector SVGs for a dual-winding transformer (coils and core lines) and a PCB (circuit board rectangular shape with layout tracks and circular solder pads) to the baseline seed package.
- **Auto Part Photo Thumbnail Fallback**: Implemented a three-stage fallback rendering logic in `PartsList.tsx`, `CategoryList.tsx`, and `LocationList.tsx` that automatically assigns a part's uploaded photo as its row cell thumbnail (cropped to fit) if no schematic icon is manually selected, and falls back to a generic hash placeholder only if both are missing.

## [1.9.1] - 2026-05-25

### Fixed
- **Automated Upgrade Seeding**: Fixed a bug in `setup.sh` where database seeding was skipped on upgraded environments when a database restoration was detected. Seeding is now always run during updates. Since the database seeder checks for existing icons and uses standard `upsert` queries, it is fully idempotent and safely registers new system icons without affecting any existing product catalog entries.

## [1.9.0] - 2026-05-24

### Added
- **High-Contrast Icon Visibility**: Redesigned the icon grid cells and selectors inside `IconPicker.tsx` to mount SVGs inside isolated white background contrast boxes (`bg-white` and padding), making dark technical schematic icons legible regardless of browser dark mode active theme settings.
- **Seeded Switch, Light, and Pin Connector**: Added custom-designed schematic SVGs for Switch (toggle lever), Light (indicator lamp circle with X), and Pin Connector (electronic pin headers block) to the baseline seed package.

## [1.8.9] - 2026-05-24

### Added
- **Client-Side Image Auto-Compression & Downscaling**: Added browser-native image compression using HTML5 Canvas. Newly uploaded part photos are automatically resized to fit within 1000x1000 pixels and converted to optimized JPEG format at 80% quality *before* transmitting over the network. This shrinks typical part photos from ~1.5MB down to ~100KB (a 90%+ decrease), saving substantial storage space and network transfer times.
- **1GB Backup and Restore Limit**: Increased Next.js Server Action body size limit from `200mb` to `1gb` to support massive catalog backups and restorations.

## [1.8.8] - 2026-05-23

### Added
- **Automated Migration Hook**: Built a zero-downtime automated backup and restore hook directly into `setup.sh`. Updating the codebase automatically dumps the existing Postgres records, packages current media uploads into a temporary migration package, compiles the new version, restores all database records/media files, and re-validates the database structure.
- **Docker Compose Namespace Enforcement**: Configured a persistent `name: inventory-pro` attribute across compose settings to isolate volumes globally regardless of directory moves.

## [1.8.7] - 2026-05-22

### Added
- **Named Docker Volumes Persistence**: Migrated the uploads directory (`/public/uploads`) to persistent named Docker volumes (`uploads_data`), decoupling user uploads from the local codebase directory and resolving datasheet loss on codebase updates.
- **Backup Script Parity**: Adapted `scripts/backup.sh` to extract uploads via `docker cp` directly from the named volume namespace.

## [1.8.6] - 2026-05-22

### Fixed
- **Clean Database Seeding**: Completely removed legacy, local test/mock parts and demo category seeding code from both JS and TS Prisma seed scripts. Running setup/update scripts on live environments now only creates the baseline admin user and default icon library pool, preventing any unsolicited test inventory injection.

## [1.8.5] - 2026-05-22

### Fixed
- **Prisma Connection Re-initialization**: Added an explicit `prisma.$disconnect()` flush inside the restoration action post-success. This cleanly drops terminated/dead Postgres sockets and forces Prisma client to initialize a fresh, healthy connection pool on layout refresh, resolving Server-Side Exception (P1017) crashes.

## [1.8.4] - 2026-05-22

### Fixed
- **Browser Compatibility**: Explicitly referenced standard global `window.confirm` to ensure bulletproof dialog handler execution on Google Chrome and prevent quiet failures.

## [1.8.3] - 2026-05-22

### Fixed
- **Native Upload Streaming**: Removed memory-blocking client-side FileReader base64 encoding. Replaced it with native, multi-part binary streaming via standard `FormData` uploads to Server Actions. This resolves browser out-of-memory issues when uploading large compressed database and media archives.

## [1.8.2] - 2026-05-22

### Fixed
- **Restore Payload Limit**: Increased Next.js Server Action body limit configuration from 10MB to 200MB to fully support large compressed data + media archive uploads.

## [1.8.1] - 2026-05-22

### Fixed
- **Resilient Media Lookup**: Implemented a highly robust 4-level resolution fallback chain in both image and datasheet routes to support standard, extension-based, and legacy timestamp-prefixed filenames.
- **SQL Restore Bug**: Fixed a database raw SQL update issue in `autoMigrateRestoredBlobs` that wiped out unselected media urls during backup restoration.

## [1.8.0] - 2026-05-22

### Added
- **Filesystem Storage Migration**: Refactored database BLOB fields back to direct host filesystem storage under `./public/uploads`, reducing database bloat and query latencies.
- **Unified Backup/Restore**: Implemented unified base64 compressed `.tar.gz` archiving that bundles the SQL database dump along with full host filesystem media directory structure.

## [1.7.1] - 2026-05-03

### Added
- **Admin Icon Management**: Admins can now delete icons from the shared pool directly from the Icon Picker interface.

## [1.7.0] - 2026-05-02

### Added
- **Icon Library**: Introduced a centralized, reusable vector Icon Library for parts, drastically improving UI loading performance in list views.
- **Icon Picker Component**: Added an integrated UI to select or upload new SVG/PNG icons directly from the part creation/edit modals.
- **Default Icon Pack**: Shipped a pre-loaded pack of minimal electronics icons (Resistors, Capacitors, Memory, ICs, etc.) out-of-the-box.
- **Barcode Support**: Added support for searching parts using auto-generated UPC numbers via standard keyboard-emulating barcode scanners, along with quick copy capabilities.

## [1.6.4] - 2026-04-12

### Changed
- **Neutral Page Load**: The Categories and Locations pages no longer automatically select the first item on load. Users are now prompted to select a category or location to view its parts.

## [1.6.3] - 2026-04-08

### Changed
- **Loading UI Refinement**: Simplified the loading screen design by removing the icon container and increasing the clipboard size for a cleaner, more focused visual during transitions.

## [1.6.2] - 2026-04-08

### Changed
- **Branding Update**: Replaced the "IP" initialism with a professional `ClipboardList` icon in the header and global loading state for a more illustrative brand identity.

## [1.6.1] - 2026-04-08

### Fixed
- **Docker Build Error**: Added `.gitkeep` files to the `public/` directory ensuring it is tracked by Git even when empty, resolving build failures on remote servers.

## [1.6.0] - 2026-04-08

### Added
- **Global Loading State**: Branded loading indicator (`app/loading.tsx`) for better visual feedback during page transitions.
- **Advanced Filtering**: New status filtering in the Parts Catalog (missing datasheets, images, etc.).

### Changed
- **Major Performance Overhaul**: Refactored tree-building algorithms from $O(N^2)$ to $O(N)$ in `CategoryList`, `LocationList`, and hierarchical pickers.
- **UI Architecture**: Standardized part details into a modern responsive modal view.
- **Optimized Aesthetics**: Replaced expensive blur effects with a high-performance `glass-light` style for repeated list items.
- **Production Infrastructure**: Implemented multi-stage Docker builds with resource limits and optimized database indexing.

### Fixed
- UI freezing and latency during page navigation and hierarchical expansions.
- Inconsistent modal layouts between Add and Edit views.


## [1.2.2] - 2026-04-04

### Fixed
- UI synchronization issue where the details panel showed stale data (old location, missing images) after a part update.
- Missing `imageUrl` in the parts list interface.

## [1.2.1] - 2026-04-04

### Fixed
- Issue where selecting a storage location when adding/updating a part was ignored (always defaulted to Unassigned).

## [1.2.0] - 2026-04-04

### Added
- Horizontal scrolling for deeply nested categories and locations to improve readability on small screens and deep hierarchies.

### Fixed
- Visual bug where category edit form would overflow the sidebar container.
