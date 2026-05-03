# Changelog

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
