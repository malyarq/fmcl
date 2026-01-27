# FriendLauncher - Development Roadmap

## 📋 Current Project Status

### ✅ Implemented

#### Core Functionality
- ✅ **P2P Multiplayer (FriendTunnel)** - unique project feature
- ✅ **Offline/Cracked Support** - via authlib-injector
- ✅ **Mod Loader Support** - Forge, Fabric, NeoForge, OptiFine
- ✅ **Version Management** - download and install Minecraft versions
- ✅ **Basic Instance Management** - creation, configuration storage
- ✅ **Settings** - basic launcher and game settings
- ✅ **Automatic Launcher Updates**

#### Modpacks (partial)
- ✅ **Modpack Browser** - search on CurseForge and Modrinth
- ✅ **Modpack Installation** - basic installation
- ✅ **Modpack Import** - import support
- ✅ **Modpack Export** - basic export support

#### Mods (partial)
- ✅ **Mod Service** - basic structure
- ✅ **Platforms** - integration with CurseForge and Modrinth

#### UI/UX
- ✅ **Basic UI Components** - Button, Input, Modal, Select, etc.
- ✅ **Theme System** - light/dark theme
- ✅ **Accent Colors** - color customization
- ✅ **Internationalization** - EN/RU support
- ✅ **Onboarding** - welcome tour

---

## 🗺️ Development Roadmap

---

## Phase 0: Critical UI/UX Improvements
**Priority: Critical**  
**Goal:** Simplify interface for simple gameplay and improve modpack workflow

### 0.1 Mode Switcher ⭐ CRITICAL

**Problem:** No separation between simple gameplay and modpacks, interface is overloaded

- [ ] **Mode Switcher**
  - Add "🎮 Simple Play" / "📦 Modpacks" switcher in Sidebar Header
  - Save selected mode in settings
  - Smooth switching animation

- [ ] **"Simple Play" Mode**
  - Simplified Sidebar: only Nickname, Version, Play button
  - "Advanced" section (collapsed by default) for mod loaders
  - Main screen: "Last Game" card with quick launch
  - Quick actions: Multiplayer, Settings
  - "Go to Modpacks" link

- [ ] **"Modpacks" Mode**
  - Full Sidebar with all settings
  - Main screen: modpack list (current state)
  - All modpack management features

**Dependencies:** None  
**Time:** 1-2 weeks

---

### 0.2 Simplified Sidebar for Simple Play

- [ ] **Adaptive Sidebar**
  - In "Simple Play" mode: minimal set of fields
  - In "Modpacks" mode: full set of settings
  - Smooth transition between states

- [ ] **"Advanced" Section**
  - Collapsed by default
  - Contains: Mod Loaders, OptiFine, Java Settings
  - Remember user preference (always expand/collapse)
  - Hint on first use

**Dependencies:** 0.1 (Mode Switcher)  
**Time:** 1 week

---

### 0.3 Main Screen for Simple Play

- [ ] **"Last Game" Card**
  - Shows last settings (version, nickname)
  - Large "Play Now" button
  - Quick launch with saved settings
  - Visually appealing card

- [ ] **Quick Actions**
  - Compact buttons: 🌐 Multiplayer, ⚙️ Settings
  - Located below card or in header

- [ ] **Switch to Modpacks**
  - Text link or button
  - Smooth transition to "Modpacks" mode

**Dependencies:** 0.1 (Mode Switcher)  
**Time:** 1 week

---

### 0.4 Step-by-Step Modpack Creation Wizard

**Problem:** Modpack creation is not obvious, process is not step-by-step

- [ ] **Step 1: Basic Information**
  - Modpack name (required)
  - Description (optional)
  - Progress indicator [1/3]

- [ ] **Step 2: Version and Mod Loader**
  - Minecraft version selection
  - Mod loader selection (None, Forge, Fabric, NeoForge)
  - Progress indicator [2/3]

- [ ] **Step 3: Add Mods (optional)**
  - Option to skip or add mods
  - Mod search (CurseForge/Modrinth)
  - Mod list with checkboxes
  - Progress indicator [3/3]

- [ ] **Navigation**
  - "Back" and "Next" / "Create" buttons
  - Validation on each step
  - Progress saving (can close and return)

**Dependencies:** None  
**Time:** 1-2 weeks

---

### 0.5 Improved Mod Management in Modpack

- [ ] **"Mods" Tab in ModpackDetails**
  - Mod list with checkboxes (enable/disable)
  - "+ Add Mod" button
  - Mod search directly in list
  - Settings and delete buttons for each mod
  - Statistics: total mods / enabled

- [ ] **Drag & Drop for Mod Order**
  - Drag mods to change load order
  - Visual indication when dragging
  - Automatic order saving

- [ ] **Improved Modpack Card**
  - "Play" button instead of "Select" (more intuitive)
  - ⚙️ icon for settings (more compact)
  - Menu (⋮) for additional actions (Duplicate, Export, Delete)

**Dependencies:** 1.3 (Mod Management)  
**Time:** 1-2 weeks

---

### 0.6 Progressive Disclosure

- [ ] **Collapsible Sections in Sidebar**
  - "Advanced" section collapsed by default
  - Smooth expand/collapse animation
  - Remember user preference

- [ ] **Hidden Settings in Modpacks**
  - Advanced settings in "Advanced" section
  - Hint on first use
  - Launcher setting: "Always show all settings"

**Dependencies:** 0.2 (Simplified Sidebar)  
**Time:** 3-5 days

---

### 0.7 Improved Navigation

- [ ] **Breadcrumbs**
  - Show navigation path (Home > Modpacks > My Modpack)
  - Clickable elements for quick navigation
  - Adaptive (hidden on small screens)

- [ ] **Quick Access Icons**
  - 🏠 Home (Simple Play)
  - 📦 Modpacks
  - ⚙️ Settings
  - 🌐 Multiplayer
  - Location: in Sidebar Header or TitleBar

- [ ] **Back Button**
  - In modals and detail pages
  - Hotkey: Esc

**Dependencies:** None  
**Time:** 3-5 days

---

## Phase 1: Stabilization and Core Functionality Enhancement
**Priority: High**  
**Goal:** Bring current functions to stable state

### 1.1 Instance Management Improvement

- [ ] **UI for Instance Management**
  - Instance list with cards (in "Modpacks" mode)
  - Create new instance via UI
  - Edit instance
  - Delete instance with confirmation
  - Duplicate instance
  - Rename instance
  - Icons and previews for instances
  - Instance status (active, running, update available)

- [ ] **Context Menu for Instances**
  - Right-click → Launch, Edit, Delete, Export, Duplicate
  - Quick actions
  - Visual indication of active instance

- [ ] **Instance Grouping and Filtering**
  - By Minecraft version
  - By mod loader
  - By modpack
  - Search by name
  - Sorting (by date, by name, by version)

**Dependencies:** 0.1 (Mode Switcher)  
**Time:** 2-3 weeks

---

### 1.2 Modpack Enhancement

- [ ] **Modpack Updates** ⭐ Top Feature
  - Automatic update detection (background process)
  - Update notifications (ModpackUpdateNotification)
  - One-click update installation
  - Modpack version history
  - Setting: automatic updates / notifications only

- [ ] **Modpack Browser Improvement**
  - Filters (MC version, mod loader, category, platform)
  - Sorting (popularity, date, alphabetical, downloads)
  - Favorites (save in localStorage)
  - View history
  - Pagination with configurable results count
  - Modpack preview (without opening modal)

- [ ] **Modpack Export/Import** ⭐ Top Feature
  - Export to CurseForge format (.zip)
  - Export to Modrinth format (.mrpack)
  - Export to MultiMC format
  - Export to Prism Launcher format
  - Export to ATLauncher format
  - Import from all formats
  - Import validation
  - Automatic problem resolution on import

**Dependencies:** None  
**Time:** 3-4 weeks

---

### 1.3 Mod Management

- [ ] **UI for Mod Management**
  - Installed mod list (in modpack details)
  - Enable/disable mods (checkboxes)
  - Delete mods
  - Mod information (version, dependencies, description, author)
  - Mod grouping (by category, by mod loader)
  - Search in mod list

- [ ] **Mod Download and Installation**
  - Mod search on CurseForge/Modrinth (built-in search)
  - Install mods to instance/modpack
  - Automatic dependency resolution
  - Mod updates (automatic detection)
  - Bulk install/delete

- [ ] **Dependency Management**
  - Show mod dependencies (visual tree)
  - Automatic dependency installation
  - Conflict detection
  - Visual problem indication (red badges)
  - Version incompatibility warnings

**Dependencies:** 0.5 (Improved Mod Management)  
**Time:** 3-4 weeks

---

### 1.4 Additional UI/UX Improvements

- [ ] **Improved Empty States**
  - For simple play: welcome message with hints
  - For modpacks: call to action (Browser, Create, Import)
  - Visual icons and illustrations
  - Hotkeys in hints

- [ ] **Improved Notifications**
  - Extend Toast system
  - Update notifications (modpacks, mods, launcher)
  - Error notifications with actions
  - Operation completion notifications
  - Notification grouping

- [ ] **Improved Hotkeys**
  - `Ctrl+1`: Switch to "Simple Play"
  - `Ctrl+2`: Switch to "Modpacks"
  - `Ctrl+P`: Play (quick launch)
  - `Ctrl+M`: Multiplayer
  - `Ctrl+,`: Settings
  - `Ctrl+N`: Create modpack
  - `Ctrl+O`: Modpack browser
  - `Ctrl+E`: Modpack details
  - `Esc`: Close modal / Go back
  - Show hotkeys in tooltips

**Dependencies:** 0.1-0.7 (Phase 0)  
**Time:** 1-2 weeks

---

## Phase 2: Extended Content Management
**Priority: Medium**  
**Goal:** Add resource pack, shader, and other content management

### 2.1 Resource Pack Management ⭐ Top Feature

- [ ] **Resource Pack Download**
  - Search on Modrinth/CurseForge
  - Install to instance/modpack
  - Enable/disable resource packs (checkboxes)
  - Resource pack load order (drag & drop)
  - Resource pack preview

- [ ] **UI for Resource Packs**
  - Installed resource pack list (in instance/modpack details)
  - Resource pack preview (screenshots)
  - Delete resource pack
  - Resource pack information (version, author, description)

**Dependencies:** 1.1 (Instance Management)  
**Time:** 2 weeks

---

### 2.2 Shader Management ⭐ Top Feature

- [ ] **Shader Download**
  - Search on Modrinth
  - Install shader packs
  - Manage shaders in instance/modpack

- [ ] **UI for Shaders**
  - Installed shader list
  - Switch between shaders (radio buttons)
  - Delete shaders
  - Shader preview (screenshots)

**Dependencies:** 1.1 (Instance Management)  
**Time:** 2 weeks

---

### 2.3 Datapack Management ⭐ Top Feature (Modrinth App)

- [ ] **Datapack Download**
  - Search on Modrinth
  - Install to instance/modpack
  - Manage datapacks

- [ ] **UI for Datapacks**
  - Installed datapack list
  - Enable/disable datapacks
  - Datapack information

**Dependencies:** 1.1 (Instance Management)  
**Time:** 1-2 weeks

---

### 2.4 World Management

- [ ] **World List**
  - View saved worlds (in instance details)
  - Delete worlds
  - Copy worlds
  - World backup
  - Rename worlds
  - World information (creation date, size, screenshot)

**Dependencies:** 1.1 (Instance Management)  
**Time:** 1-2 weeks

---

## Phase 3: Advanced Features
**Priority: Medium-Low**  
**Goal:** Add features for power users

### 3.1 Extended Java Settings

- [ ] **Java Management**
  - Automatic Java detection (partially exists)
  - Select Java version for instance
  - JVM arguments management (advanced editor)
  - Memory settings (Xmx, Xms) with visual slider
  - Performance profiles (Low, Medium, High, Custom)
  - Invalid settings warnings

**Dependencies:** 1.1 (Instance Management)  
**Time:** 1-2 weeks

---

### 3.2 Logs and Debugging ⭐ Top Feature (Prism Launcher)

- [ ] **Improved Logs**
  - Color-coded logs (ERROR - red, WARN - yellow, INFO - blue, DEBUG - gray)
  - Log filtering (by level, by source, by text)
  - Log search (Ctrl+F)
  - Export logs (to file)
  - Automatic error detection (highlighting)
  - Copy selected text

- [ ] **Console**
  - Built-in console for Minecraft (partially exists)
  - Send commands to game
  - Command history (up/down arrows)
  - Command autocomplete
  - Syntax highlighting

**Dependencies:** None  
**Time:** 2-3 weeks

---

### 3.3 Screenshot Management ⭐ Top Feature (Prism Launcher)

- [ ] **Screenshot Viewing**
  - Screenshot list from game (in instance details)
  - Screenshot preview (gallery)
  - Delete screenshots
  - Open screenshot folder
  - Rename screenshots
  - Copy screenshots

- [ ] **Additional Features** (optional)
  - Upload screenshots (to cloud or server)
  - Share screenshot
  - Basic screenshot editing

**Dependencies:** 1.1 (Instance Management)  
**Time:** 1-2 weeks

---

### 3.4 Instance Export/Import ⭐ Top Feature

- [ ] **Instance Export**
  - Export to various formats (MultiMC, Prism, ATLauncher, CurseForge, Modrinth)
  - Include/exclude mods, worlds, settings
  - Archive compression
  - Export path selection

- [ ] **Instance Import**
  - Import from other launchers (MultiMC, Prism, ATLauncher, CurseForge, Modrinth)
  - Import validation
  - Automatic problem resolution
  - Preview before import
  - Select elements for import

**Dependencies:** 1.1 (Instance Management), 1.2 (Modpack Export/Import)  
**Time:** 2-3 weeks

---

## Phase 4: Optimization and Performance
**Priority: Medium**  
**Goal:** Improve performance and resource efficiency

### 4.1 Hard Links System ⭐ Top Feature (XMCL)

**Problem:** Disk space duplication with multiple instances sharing common mods

- [ ] **Centralized Storage**
  - Single storage for mods, resource packs, shaders
  - Use hard links instead of copying files
  - Disk space savings (up to 90% with multiple instances)
  - Automatic hard link creation on install

- [ ] **Resource Management**
  - Automatic deduplication
  - Cleanup unused resources
  - Disk usage statistics
  - Space savings visualization

**Dependencies:** 1.3 (Mod Management), 2.1-2.3 (Resource Packs, Shaders, Datapacks)  
**Time:** 3-4 weeks

---

### 4.2 Performance Optimization

- [ ] **Caching**
  - Modpack metadata cache (local storage)
  - Image cache (modpack icons, previews)
  - Minecraft versions cache
  - Mod cache (metadata)
  - Cache size configuration
  - Cache cleanup

- [ ] **Lazy Loading**
  - Lazy load UI components (partially exists)
  - Lazy load lists (virtualization)
  - Virtualize long lists (react-window or similar)
  - Lazy load images (LazyImage already exists)

- [ ] **Render Optimization**
  - Component memoization (React.memo)
  - Re-render optimization
  - Debounce for search and filters

**Dependencies:** None  
**Time:** 2-3 weeks

---

### 4.3 Download Improvements

- [ ] **Parallel Downloads**
  - Parallel file downloads (up to N simultaneous)
  - Download queue with priorities
  - Download priorities (critical files first)
  - Progress for each download

- [ ] **Download Resumption**
  - Save download progress
  - Resume after restart
  - Validate downloaded files (checksum)
  - Retry on error

**Dependencies:** None  
**Time:** 2 weeks

---

## Phase 5: Extended UI Customization
**Priority: Low**  
**Goal:** Add advanced interface customization options

### 5.1 Extended Themes ⭐ Top Feature (XMCL)

- [ ] **Custom Colors**
  - Card color settings
  - Panel color settings
  - Background color settings
  - Highlight color settings
  - Error color settings
  - Separate storage for light/dark theme
  - Color palette with preview

- [ ] **Additional Themes**
  - Preset themes (High Contrast, Dark+, Light+)
  - Theme import/export
  - Create custom themes

**Dependencies:** None  
**Time:** 2-3 weeks

---

### 5.2 Background Effects ⭐ Top Feature (XMCL)

- [ ] **Background Images**
  - Load background image
  - Transparency settings
  - Background blur
  - Positioning (center, stretch, tile)
  - Multiple preset backgrounds

- [ ] **Background Videos** (optional)
  - Background video support (MP4, WebM)
  - Volume settings
  - Loop playback
  - Pause on inactivity

- [ ] **Particles** (optional)
  - Animated background particles
  - Intensity settings
  - Speed settings
  - Different particle types

**Dependencies:** None  
**Time:** 2-3 weeks

---

### 5.3 Additional UI Settings

- [ ] **Sizes and Layout**
  - Font size settings (small, medium, large)
  - Element size settings
  - Panel position settings (Sidebar left/right)
  - Compact/expanded mode

- [ ] **Animations**
  - Enable/disable animations
  - Animation speed settings (fast, normal, slow)
  - Animation preview

**Dependencies:** None  
**Time:** 1 week

---

## Phase 6: Additional Features
**Priority: Low**  
**Goal:** Add additional useful features

### 6.1 Custom Accounts and Skins ⭐ Top Feature (HMCL, XMCL)

- [ ] **Third-Party Service Support**
  - Blessing Skin (full integration)
  - Authlib Injector (partially exists, enhance)
  - LittleSkin
  - Other skin services (extensible system)

- [ ] **Account Management**
  - Multiple accounts
  - Switch between accounts
  - Skin management
  - Custom skins (file upload)

**Dependencies:** None  
**Time:** 2-3 weeks

---

### 6.2 Mirrors and CDN ⭐ Top Feature (XMCL)

- [ ] **Mirror Management**
  - BMCL API support
  - Custom mirrors (add your own)
  - Automatic best mirror selection (by speed)
  - Fallback mirrors
  - Mirror speed testing
  - Mirror priority settings

**Dependencies:** None  
**Time:** 2 weeks

---

### 6.3 Statistics and Analytics

- [ ] **Usage Statistics**
  - Play time (by instances, total)
  - Launch count
  - Popular modpacks
  - Instance statistics
  - Usage graphs
  - Statistics export

**Dependencies:** None  
**Time:** 1-2 weeks

---

### 6.4 Social Features (optional)

- [ ] **Instance Sharing**
  - Generate share code
  - Import by code
  - Cloud storage (optional, via external service)

**Dependencies:** 3.4 (Instance Export/Import)  
**Time:** 1-2 weeks

---

## Phase 7: Accessibility and Localization
**Priority: Medium**  
**Goal:** Improve accessibility and multi-language support

### 7.1 Accessibility

- [ ] **Screen Reader Support**
  - ARIA attributes on all interactive elements
  - Semantic markup (HTML5)
  - Keyboard navigation (full support)
  - Descriptions for all elements

- [ ] **Keyboard Navigation**
  - Hotkeys (extended set)
  - Full navigation without mouse
  - Hotkey hints (in tooltips and settings)
  - Hotkey configuration

- [ ] **Visual Accessibility**
  - High contrast mode
  - Interface scaling (zoom)
  - Font size settings
  - Color blindness (don't rely only on color)

**Dependencies:** None  
**Time:** 2-3 weeks

---

### 7.2 Localization

- [ ] **Additional Languages**
  - Chinese (considering XMCL, HMCL, PCL2 popularity) ⭐ Priority
  - German
  - French
  - Spanish
  - Japanese

- [ ] **Translation Improvements**
  - Review existing translations (EN/RU)
  - Contextual translations
  - Community translation system
  - Automatic translation validation

**Dependencies:** None  
**Time:** 2-4 weeks (depending on number of languages)

---

## 🎯 Implementation Priorities

### Critically Important (do first)

1. ✅ **Phase 0: Critical UI/UX Improvements**
   - Mode Switcher (Simple Play / Modpacks)
   - Simplified Sidebar
   - Main Screen for Simple Play
   - Step-by-Step Modpack Creation Wizard
   - Improved Mod Management

2. ✅ **Stable P2P Multiplayer** (already exists)
3. ✅ **Stable Basic Game Launch** (already exists)

### High Priority (next stage)

1. **Instance Management via UI** (Phase 1.1)
2. **Full Mod Management** (Phase 1.3)
3. **Modpack Updates** (Phase 1.2) ⭐ Top Feature
4. **Modpack Export/Import** (Phase 1.2) ⭐ Top Feature

### Medium Priority

1. **Resource Pack and Shader Management** (Phase 2) ⭐ Top Features
2. **Datapack Management** (Phase 2.3) ⭐ Top Feature
3. **Improved Logs and Console** (Phase 3.2) ⭐ Top Feature
4. **Screenshot Management** (Phase 3.3) ⭐ Top Feature
5. **Instance Export/Import** (Phase 3.4) ⭐ Top Feature
6. **Hard Links System** (Phase 4.1) ⭐ Top Feature
7. **Accessibility** (Phase 7.1)

### Low Priority (when time permits)

1. **Extended UI Customization** (Phase 5) ⭐ Top Features
2. **Custom Accounts and Skins** (Phase 6.1) ⭐ Top Feature
3. **Mirrors and CDN** (Phase 6.2) ⭐ Top Feature
4. **Additional Languages** (Phase 7.2)

### Optional (if there's demand)

1. Background videos and particles (Phase 5.2)
2. Social features (Phase 6.4)
3. Statistics and analytics (Phase 6.3)

---

## 📊 Success Metrics

### Technical Metrics
- [ ] Launcher startup time < 3 seconds
- [ ] Game launch time < 30 seconds (for vanilla)
- [ ] Memory usage < 200MB (idle)
- [ ] No memory leaks
- [ ] P2P connection stability > 95%
- [ ] Disk space savings > 50% (with Hard Links with 5+ instances)

### Functional Metrics
- [ ] Support for all major mod loaders
- [ ] Working with modpacks from CurseForge and Modrinth
- [ ] Successful import from other launchers (MultiMC, Prism, ATLauncher)
- [ ] Correct operation on Windows, Linux, macOS
- [ ] Support for all content types (mods, resource packs, shaders, datapacks)

### UX Metrics
- [ ] Interface intuitiveness (testing with new users)
- [ ] Time to first game launch < 2 minutes (for simple play)
- [ ] Number of clicks for main operations < 3
- [ ] User satisfaction > 4.5/5 (survey)
- [ ] Modpack creation simplicity (testing with beginners)

---

## 🔄 Iterative Approach

The roadmap is divided into phases, but implementation can be iterative:

1. **Minimum Viable Product (MVP)** for each phase
2. **Testing** with real users
3. **Feedback** and plan adjustments
4. **Enhancement** based on feedback

---

## 📝 Notes

### Technical Debt
- [ ] Refactor old components
- [ ] Improve typing
- [ ] Optimize bundle size
- [ ] Improve test coverage
- [ ] Migrate to new patterns (if needed)

### Documentation
- [ ] Update README with new features
- [ ] Developer documentation
- [ ] User guides
- [ ] Video tutorials
- [ ] FAQ

### Security
- [ ] P2P connection security audit
- [ ] Validate all user inputs
- [ ] Secure data storage
- [ ] Protection against XSS and other vulnerabilities
