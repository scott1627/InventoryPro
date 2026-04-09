# Changelog

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
