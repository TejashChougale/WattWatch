/**
 * WATTWATCH - Authentication & Account Module
 * Manages user authentication interface, login, account creation,
 * recovery key validation, show/hide password controls, and guest mode.
 * 
 * Non-negotiable requirements:
 * 1. Product name strictly WattWatch (no version numbers).
 * 2. Username and password only (no email, no phone).
 * 3. Support both Guest Mode and registered accounts.
 * 4. Preserve existing guest-mode localStorage data.
 * 5. Do not implement fake auth or fake local recovery.
 */

const WattWatchAuth = {
  currentTab: 'login', // 'login' | 'signup' | 'recovery'
  isFirebaseConfigured: false, // Flag indicating whether live Firebase backend is initialized
  currentUser: null, // Active user object { uid, username, displayName } or null for Guest Mode
  hasUserChosenSession: false, // Whether the user has explicitly resolved the startup login gate
  chosenSessionType: null, // 'account' | 'guest' | null (null when startup gate unresolved)
  _eventsBound: false, // Guard against duplicate event listener registration
  _isSubmitting: false, // Guard against concurrent/duplicate form submissions
  auth: null, // Firebase Auth instance
  db: null, // Cloud Firestore instance
  signInWithEmailAndPassword: null,
  createUserWithEmailAndPassword: null,
  firebaseSignOut: null,
  onAuthStateChanged: null,
  updateProfile: null,
  doc: null,
  setDoc: null,
  getDoc: null,
  serverTimestamp: null,

  /**
   * Initializes authentication module, binds UI triggers and listeners,
   * presents startup login screen, and asynchronously connects Firebase backend services.
   */
  init() {
    this.bindEvents();
    this.updateTopbarState();
    this.updateGuestImportCheckbox();
    this.openAuthModalOnStartup();
    this.initFirebase();
  },

  /**
   * Updates close button visibility inside authModal
   * Hidden when user has not yet resolved the startup gate, visible once a session is established
   */
  updateCloseButtonsVisibility() {
    const closeX = document.getElementById('authModalCloseX');
    const footerClose = document.getElementById('authModalFooterClose');
    const displayVal = this.hasUserChosenSession ? '' : 'none';
    if (closeX) closeX.style.display = displayVal;
    if (footerClose) footerClose.style.display = displayVal;
  },

  /**
   * Displays the Login / Create Account screen on every fresh page load or refresh.
   * Does not auto-enter guest mode or bypass the auth gate.
   */
  openAuthModalOnStartup() {
    this.hasUserChosenSession = false;
    this.chosenSessionType = null;
    document.body.classList.add('auth-gate-active');
    this.updateCloseButtonsVisibility();
    const modal = document.getElementById('authModal');
    if (!modal) return;

    if (this.currentUser) {
      this.showResumePane();
    } else {
      this.switchTab('login');
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  },

  /**
   * Asynchronously loads and initializes Firebase Authentication & Cloud Firestore
   */
  async initFirebase() {
    try {
      let config = null;
      try {
        config = await import('./firebase-config.js');
      } catch (err1) {
        config = await import('./js/firebase-config.js');
      }

      if (config && config.auth && config.db) {
        this.auth = config.auth;
        this.db = config.db;
        this.signInWithEmailAndPassword = config.signInWithEmailAndPassword;
        this.createUserWithEmailAndPassword = config.createUserWithEmailAndPassword;
        this.firebaseSignOut = config.signOut;
        this.onAuthStateChanged = config.onAuthStateChanged;
        this.updateProfile = config.updateProfile;
        this.doc = config.doc;
        this.setDoc = config.setDoc;
        this.getDoc = config.getDoc;
        this.serverTimestamp = config.serverTimestamp;
        this.isFirebaseConfigured = true;

        console.log('[WattWatch Auth] Firebase Authentication & Cloud Firestore initialized successfully');

        // Bind auth state change observer
        if (this.onAuthStateChanged && this.auth) {
          this.onAuthStateChanged(this.auth, async (user) => {
            if (user) {
              // If user has already chosen Guest Mode before this callback resolved,
              // strictly respect their choice: do not switch workspace or session.
              if (this.chosenSessionType === 'guest') {
                return;
              }

              const email = user.email || '';
              const rawUsername = email.includes('@') ? email.split('@')[0] : (user.displayName || 'User');
              let displayName = user.displayName || rawUsername;

              if (this.db && this.getDoc && this.doc) {
                try {
                  const snap = await this.getDoc(this.doc(this.db, "users", user.uid));
                  if (snap.exists() && snap.data().displayName) {
                    displayName = snap.data().displayName;
                  }
                } catch (e) {
                  // ignore network failure
                }
              }

              this.currentUser = {
                uid: user.uid,
                username: rawUsername,
                displayName: displayName
              };

              // If user has not yet chosen a session on startup, show resume pane
              if (!this.hasUserChosenSession) {
                this.showResumePane();
              } else if (this.chosenSessionType === 'account') {
                WattWatchStorage.setActiveUser(user.uid);
                this.updateTopbarState();
                if (typeof WattWatchApp !== 'undefined' && WattWatchApp.refreshAll) {
                  WattWatchApp.refreshAll();
                }
              }
              // If this.chosenSessionType === 'guest', do NOT switch workspace to user.uid
              // and do NOT reopen the modal!
            } else {
              this.currentUser = null;
              if (!this.hasUserChosenSession) {
                const resumePane = document.getElementById('authPane-resume');
                if (resumePane && resumePane.classList.contains('active')) {
                  this.switchTab('login');
                }
              } else if (this.chosenSessionType === 'account') {
                // If account session was signed out out-of-band, cleanly reset
                this.hasUserChosenSession = false;
                this.chosenSessionType = null;
                WattWatchStorage.setActiveUser(null);
                this.updateTopbarState();
                if (typeof WattWatchApp !== 'undefined' && WattWatchApp.refreshAll) {
                  WattWatchApp.refreshAll();
                }
              }
            }
          });
        }
      } else {
        throw new Error('Firebase configuration module did not export auth or db instances');
      }
    } catch (error) {
      console.warn('[WattWatch Auth] Firebase initialization skipped or failed:', error);
      this.auth = null;
      this.db = null;
      this.isFirebaseConfigured = false;
    }
  },

  /**
   * Normalizes username to a consistent internal Firebase email identifier
   * @param {string} username
   * @returns {string}
   */
  getInternalEmail(username) {
    const clean = username.trim().toLowerCase();
    return `${clean}@wattwatch.internal`;
  },

  /**
   * Updates topbar button label and guest indicator
   */
  updateTopbarState() {
    const label = document.getElementById('topbarAuthLabel');
    const badge = document.getElementById('topbarGuestBadge');
    const btn = document.getElementById('btnTopbarAuth');

    if (!this.hasUserChosenSession) {
      if (label) label.textContent = 'Sign In';
      if (badge) {
        badge.textContent = 'Sign In';
        badge.className = 'badge-guest';
        badge.style.display = 'inline-flex';
        badge.style.background = 'rgba(15, 23, 42, 0.08)';
        badge.style.color = 'var(--text-secondary)';
      }
      if (btn) {
        btn.setAttribute('title', 'Please sign in or choose Guest Mode to access WattWatch');
      }
      return;
    }

    if (this.currentUser && this.chosenSessionType === 'account') {
      const name = this.currentUser.displayName || this.currentUser.username;
      if (label) label.textContent = name;
      if (badge) {
        badge.textContent = 'Account';
        badge.className = 'badge-user';
        badge.style.display = 'inline-flex';
        badge.removeAttribute('style');
      }
      if (btn) {
        btn.setAttribute('title', `Signed in as ${name} (local browser storage) — click for account details or to sign out`);
      }
    } else {
      if (label) label.textContent = 'Sign In';
      if (badge) {
        badge.textContent = 'Guest';
        badge.className = 'badge-guest';
        badge.style.display = 'inline-flex';
        badge.removeAttribute('style');
      }
      if (btn) {
        btn.setAttribute('title', 'Guest Mode (local storage) — click to sign in or create account');
      }
    }
  },

  /**
   * Binds modal controls, forms, tab switches, and password toggles
   */
  bindEvents() {
    if (this._eventsBound) return;
    this._eventsBound = true;

    // Topbar trigger
    const authBtn = document.getElementById('btnTopbarAuth');
    if (authBtn) {
      authBtn.addEventListener('click', () => {
        this.openAuthModal('login');
      });
    }

    // Modal forms
    const loginForm = document.getElementById('authLoginForm');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleLoginSubmit();
      });
    }

    const signupForm = document.getElementById('authSignupForm');
    if (signupForm) {
      signupForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleSignupSubmit();
      });
    }

    const recoveryForm = document.getElementById('authRecoveryForm');
    if (recoveryForm) {
      recoveryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.handleRecoverySubmit();
      });
    }

    // Tab buttons
    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        if (tab) this.switchTab(tab);
      });
    });

    // Password visibility toggle buttons
    document.querySelectorAll('.password-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const targetId = btn.getAttribute('data-target');
        this.togglePasswordVisibility(targetId, btn);
      });
    });

    // Recovery key auto-formatter (e.g., auto uppercase and allowed chars)
    const recoveryKeyInput = document.getElementById('recoveryKey');
    if (recoveryKeyInput) {
      recoveryKeyInput.addEventListener('input', (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        e.target.value = val;
      });
    }
  },

  /**
   * Opens the authentication modal
   * @param {string} defaultTab - 'login' | 'signup' | 'recovery'
   */
  openAuthModal(defaultTab = 'login') {
    this.clearAlert();
    const modal = document.getElementById('authModal');
    if (!modal) return;

    this.updateGuestImportCheckbox();
    this.updateCloseButtonsVisibility();

    if (this.currentUser && this.chosenSessionType === 'account') {
      this.showAccountPane();
    } else if (this.currentUser && !this.hasUserChosenSession) {
      this.showResumePane();
    } else {
      const navTabs = modal.querySelector('.auth-nav-tabs');
      if (navTabs) navTabs.style.display = 'flex';
      this.switchTab(defaultTab);
    }

    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
  },

  /**
   * Displays the session resume pane when an authenticated Firebase session exists
   */
  showResumePane() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const navTabs = modal.querySelector('.auth-nav-tabs');
    if (navTabs) navTabs.style.display = 'none';

    document.querySelectorAll('.auth-tab-pane').forEach(p => p.classList.remove('active'));
    const resumePane = document.getElementById('authPane-resume');
    if (resumePane) resumePane.classList.add('active');

    const titleEl = document.getElementById('authModalTitle');
    if (titleEl) titleEl.textContent = 'Welcome Back to WattWatch';

    const displayNameEl = document.getElementById('resumeDisplayName');
    const usernameSubEl = document.getElementById('resumeUsernameSub');
    const avatarLetterEl = document.getElementById('resumeAvatarLetter');
    const continueBtn = document.getElementById('btnResumeContinue');

    const name = (this.currentUser && (this.currentUser.displayName || this.currentUser.username)) || 'User';
    if (displayNameEl) displayNameEl.textContent = name;
    if (usernameSubEl) usernameSubEl.textContent = `@${this.currentUser ? this.currentUser.username : ''}`;
    if (avatarLetterEl) avatarLetterEl.textContent = name.charAt(0).toUpperCase();
    if (continueBtn) continueBtn.textContent = `Continue as ${name}`;
  },

  /**
   * Continues into the dashboard with the active authenticated Firebase session
   */
  resumeSession() {
    if (!this.currentUser) return;
    this.hasUserChosenSession = true;
    this.chosenSessionType = 'account';
    WattWatchStorage.setActiveUser(this.currentUser.uid);
    this.closeModal(true);
    this.updateTopbarState();

    if (typeof WattWatchApp !== 'undefined') {
      if (WattWatchApp.refreshAll) WattWatchApp.refreshAll();
      if (WattWatchApp.showToast) {
        const name = this.currentUser.displayName || this.currentUser.username;
        WattWatchApp.showToast(`Welcome back, ${name}! Your private dashboard is active.`, 'success', 'Session Resumed');
      }
    }
  },

  /**
   * Displays the active account summary pane when signed in
   */
  showAccountPane() {
    const modal = document.getElementById('authModal');
    if (!modal) return;

    const navTabs = modal.querySelector('.auth-nav-tabs');
    if (navTabs) navTabs.style.display = 'none';

    document.querySelectorAll('.auth-tab-pane').forEach(p => p.classList.remove('active'));
    const accPane = document.getElementById('authPane-account');
    if (accPane) accPane.classList.add('active');

    const titleEl = document.getElementById('authModalTitle');
    if (titleEl) titleEl.textContent = 'WattWatch Account';

    const displayNameEl = document.getElementById('accountDisplayName');
    const usernameSubEl = document.getElementById('accountUsernameSub');
    const avatarLetterEl = document.getElementById('accountAvatarLetter');

    const name = (this.currentUser && (this.currentUser.displayName || this.currentUser.username)) || 'User';
    if (displayNameEl) displayNameEl.textContent = name;
    if (usernameSubEl) usernameSubEl.textContent = `@${this.currentUser ? this.currentUser.username : ''}`;
    if (avatarLetterEl) avatarLetterEl.textContent = name.charAt(0).toUpperCase();
  },

  /**
   * Closes the authentication modal.
   * Blocks closing when the startup auth gate has not been explicitly resolved,
   * unless force=true is passed by an explicit session choice.
   * @param {boolean} [force=false]
   */
  closeModal(force = false) {
    if (!this.hasUserChosenSession && !force) {
      return false;
    }
    const modal = document.getElementById('authModal');
    if (modal) {
      modal.classList.remove('is-open');
      modal.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('auth-gate-active');
    this.clearAlert();
    this.updateCloseButtonsVisibility();
    this.updateTopbarState();
    return true;
  },

  /**
   * Updates guest import checkbox label on signup form with live count
   */
  updateGuestImportCheckbox() {
    const label = document.getElementById('signupImportGuestDataLabel');
    const wrap = document.getElementById('signupImportGuestDataWrap');
    if (!label) return;

    const guestData = WattWatchStorage.hasGuestData();
    if (guestData.hasData) {
      if (wrap) wrap.style.display = 'flex';
      label.textContent = `Import ${guestData.appliancesCount} guest appliance(s) and ${guestData.historyCount} bill record(s) into this new account (Guest data remains preserved)`;
    } else {
      label.textContent = 'Import existing guest appliances, tariff settings, and billing history into this new account';
    }
  },

  /**
   * Switches active tab inside the auth modal
   * @param {string} tabName - 'login' | 'signup' | 'recovery'
   */
  switchTab(tabName) {
    this.currentTab = tabName;
    this.clearAlert();
    this.updateGuestImportCheckbox();

    const navTabs = document.querySelector('.auth-nav-tabs');
    if (navTabs) navTabs.style.display = 'flex';

    document.querySelectorAll('.auth-tab-btn').forEach(btn => {
      const isTarget = btn.getAttribute('data-tab') === tabName;
      btn.classList.toggle('active', isTarget);
      btn.setAttribute('aria-selected', isTarget ? 'true' : 'false');
    });

    document.querySelectorAll('.auth-tab-pane').forEach(pane => {
      pane.classList.toggle('active', pane.id === `authPane-${tabName}`);
    });

    const titleEl = document.getElementById('authModalTitle');
    if (titleEl) {
      if (tabName === 'login') titleEl.textContent = 'Sign In to WattWatch';
      else if (tabName === 'signup') titleEl.textContent = 'Create WattWatch Account';
      else if (tabName === 'recovery') titleEl.textContent = 'Account Security & Access';
    }

    // Auto-focus first input in newly activated tab
    setTimeout(() => {
      const activePane = document.getElementById(`authPane-${tabName}`);
      if (activePane) {
        const firstInput = activePane.querySelector('input');
        if (firstInput) firstInput.focus();
      }
    }, 50);
  },

  /**
   * Toggles visibility of a password input
   * @param {string} inputId
   * @param {HTMLElement} btn
   */
  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';

    if (btn) {
      btn.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
      btn.setAttribute('title', isPassword ? 'Hide password' : 'Show password');
      btn.innerHTML = isPassword
        ? `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`
        : `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>`;
    }
  },

  /**
   * Handles explicit "Continue as Guest" selection
   */
  continueAsGuest() {
    this.hasUserChosenSession = true;
    this.chosenSessionType = 'guest';
    this.currentUser = null;
    WattWatchStorage.setActiveUser(null);
    this.closeModal(true);
    this.updateTopbarState();
    if (typeof WattWatchApp !== 'undefined') {
      if (WattWatchApp.refreshAll) WattWatchApp.refreshAll();
      if (WattWatchApp.showToast) {
        WattWatchApp.showToast('Continuing in Guest Mode with local storage persistence', 'info', 'Guest Access');
      }
    }
  },

  /**
   * Signs out current Firebase session and switches auth modal to login tab
   */
  async signOutAndSwitchToLogin() {
    try {
      if (this.auth && this.firebaseSignOut) {
        await this.firebaseSignOut(this.auth);
      }
    } catch (e) {
      console.warn('[WattWatch Auth] Error signing out from Firebase:', e);
    }

    this.currentUser = null;
    this.hasUserChosenSession = false;
    this.chosenSessionType = null;
    document.body.classList.add('auth-gate-active');
    this.updateCloseButtonsVisibility();
    WattWatchStorage.setActiveUser(null);
    this.updateTopbarState();
    this.switchTab('login');
    const navTabs = document.querySelector('.auth-nav-tabs');
    if (navTabs) navTabs.style.display = 'flex';
    if (typeof WattWatchApp !== 'undefined' && WattWatchApp.showToast) {
      WattWatchApp.showToast('Signed out of previous session. Please sign in or continue as guest.', 'info', 'Sign Out');
    }
  },

  /**
   * Validates username string
   * @param {string} username
   * @returns {{ valid: boolean, error?: string, username?: string }}
   */
  validateUsername(username) {
    if (!username || username.trim().length === 0) {
      return { valid: false, error: 'Please enter a username.' };
    }
    const trimmed = username.trim();
    if (trimmed.length < 3) {
      return { valid: false, error: 'Username must be at least 3 characters.' };
    }
    if (trimmed.length > 30) {
      return { valid: false, error: 'Username must be at most 30 characters.' };
    }
    if (!/^[a-zA-Z0-9_]+$/.test(trimmed)) {
      return { valid: false, error: 'Username can only contain letters, numbers, and underscores.' };
    }
    return { valid: true, username: trimmed };
  },

  /**
   * Validates password string
   * @param {string} password
   * @param {string} [confirmPassword]
   * @returns {{ valid: boolean, error?: string }}
   */
  validatePassword(password, confirmPassword) {
    if (!password || password.length === 0) {
      return { valid: false, error: 'Please enter a password.' };
    }
    if (password.length < 8) {
      return { valid: false, error: 'Password must be at least 8 characters long.' };
    }
    if (confirmPassword !== undefined && password !== confirmPassword) {
      return { valid: false, error: 'Passwords do not match.' };
    }
    return { valid: true };
  },

  /**
   * Validates recovery key format
   * @param {string} key
   * @returns {{ valid: boolean, error?: string, key?: string }}
   */
  validateRecoveryKey(key) {
    if (!key || key.trim().length === 0) {
      return { valid: false, error: 'Please enter your recovery key.' };
    }
    const cleanKey = key.trim().toUpperCase();
    if (cleanKey.length < 10) {
      return { valid: false, error: 'Please enter a valid recovery key (e.g. WATT-9B4F-7K2X-M8PQ).' };
    }
    return { valid: true, key: cleanKey };
  },

  /**
   * Handles Login form submission
   */
  async handleLoginSubmit() {
    if (this._isSubmitting) return;
    this.clearAlert();
    const usernameInput = document.getElementById('loginUsername');
    const passwordInput = document.getElementById('loginPassword');
    const submitBtn = document.getElementById('btnLoginSubmit');

    const uCheck = this.validateUsername(usernameInput ? usernameInput.value : '');
    if (!uCheck.valid) {
      this.showAlert(uCheck.error, 'error');
      if (usernameInput) usernameInput.focus();
      return;
    }

    const pCheck = this.validatePassword(passwordInput ? passwordInput.value : '');
    if (!pCheck.valid) {
      this.showAlert(pCheck.error, 'error');
      if (passwordInput) passwordInput.focus();
      return;
    }

    if (!this.isFirebaseConfigured || !this.auth || !this.signInWithEmailAndPassword) {
      this.showAlert(
        'Firebase Authentication is not available. Please verify network connectivity or continue in Guest Mode.',
        'error'
      );
      return;
    }

    const rawUsername = uCheck.username;
    const internalEmail = this.getInternalEmail(rawUsername);
    const password = passwordInput.value;

    try {
      this._isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Signing In...';
      }

      const userCredential = await this.signInWithEmailAndPassword(this.auth, internalEmail, password);
      const user = userCredential.user;

      let displayName = user.displayName || rawUsername;
      if (this.db && this.getDoc && this.doc) {
        try {
          const userDoc = await this.getDoc(this.doc(this.db, "users", user.uid));
          if (userDoc.exists() && userDoc.data().displayName) {
            displayName = userDoc.data().displayName;
          }
        } catch (e) {
          // ignore
        }
      }

      this.currentUser = {
        uid: user.uid,
        username: rawUsername.toLowerCase(),
        displayName: displayName
      };

      this.hasUserChosenSession = true;
      this.chosenSessionType = 'account';
      WattWatchStorage.setActiveUser(user.uid);
      this.closeModal(true);
      this.updateTopbarState();

      if (typeof WattWatchApp !== 'undefined') {
        if (WattWatchApp.refreshAll) WattWatchApp.refreshAll();
        if (WattWatchApp.showToast) {
          WattWatchApp.showToast(`Signed in as ${displayName}`, 'success', 'Welcome Back');
        }

        // Check if guest records exist to offer optional non-destructive transfer
        const guestData = WattWatchStorage.hasGuestData();
        if (guestData.hasData && WattWatchApp.openConfirmDialog) {
          setTimeout(() => {
            WattWatchApp.openConfirmDialog({
              title: 'Transfer Guest Data to Account?',
              message: `You have ${guestData.appliancesCount} appliance(s) and ${guestData.historyCount} bill record(s) in local guest storage. Would you like to merge them into your account in this browser? Existing account records and guest data will remain preserved.`,
              confirmText: 'Transfer Data',
              cancelText: 'Keep Separate',
              confirmClass: 'btn-primary',
              onConfirm: () => {
                const res = WattWatchStorage.migrateGuestData(user.uid);
                if (res.success) {
                  WattWatchApp.showToast(`Transferred ${res.transferredAppliances} appliance(s) and ${res.transferredHistory} record(s) into your account in this browser.`, 'success', 'Data Merged');
                  WattWatchApp.refreshAll();
                }
              }
            });
          }, 350);
        }
      }
    } catch (err) {
      console.warn('[WattWatch Auth] Login failed:', err);
      let errMsg = 'Invalid username or password. Please verify your credentials and try again.';
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        errMsg = 'Invalid username or password. Please check your spelling and try again.';
      } else if (err.code === 'auth/too-many-requests') {
        errMsg = 'Access to this account has been temporarily disabled due to many failed login attempts. Please try again later.';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = 'Network error connecting to authentication service. Please check your internet connection.';
      } else if (err.message && !err.message.includes('Firebase') && !err.message.includes('http') && !err.message.includes('API')) {
        errMsg = err.message;
      }
      this.showAlert(errMsg, 'error');
    } finally {
      this._isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Log In';
      }
    }
  },

  /**
   * Handles Create Account form submission
   */
  async handleSignupSubmit() {
    if (this._isSubmitting) return;
    this.clearAlert();
    const usernameInput = document.getElementById('signupUsername');
    const passwordInput = document.getElementById('signupPassword');
    const confirmInput = document.getElementById('signupPasswordConfirm');
    const importCheckbox = document.getElementById('signupImportGuestData');
    const submitBtn = document.getElementById('btnSignupSubmit');

    const uCheck = this.validateUsername(usernameInput ? usernameInput.value : '');
    if (!uCheck.valid) {
      this.showAlert(uCheck.error, 'error');
      if (usernameInput) usernameInput.focus();
      return;
    }

    const pCheck = this.validatePassword(
      passwordInput ? passwordInput.value : '',
      confirmInput ? confirmInput.value : ''
    );
    if (!pCheck.valid) {
      this.showAlert(pCheck.error, 'error');
      if (passwordInput && (!passwordInput.value || passwordInput.value.length < 8)) {
        passwordInput.focus();
      } else if (confirmInput) {
        confirmInput.focus();
      }
      return;
    }

    if (!this.isFirebaseConfigured || !this.auth || !this.createUserWithEmailAndPassword) {
      this.showAlert(
        'Firebase Authentication is not available. Please verify network connectivity or continue in Guest Mode.',
        'error'
      );
      return;
    }

    const rawUsername = uCheck.username;
    const cleanUsername = rawUsername.toLowerCase();
    const internalEmail = this.getInternalEmail(rawUsername);
    const password = passwordInput.value;
    const shouldImport = importCheckbox ? importCheckbox.checked : false;

    try {
      this._isSubmitting = true;
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Creating Account...';
      }

      const userCredential = await this.createUserWithEmailAndPassword(this.auth, internalEmail, password);
      const user = userCredential.user;

      if (this.updateProfile) {
        try {
          await this.updateProfile(user, { displayName: rawUsername });
        } catch (e) {
          console.warn('[WattWatch Auth] Error updating profile display name:', e);
        }
      }

      // Explicit consent check: migrate guest data to user namespace without modifying guest storage
      let migrationSummary = null;
      if (shouldImport) {
        migrationSummary = WattWatchStorage.migrateGuestData(user.uid);
      } else {
        WattWatchStorage.setActiveUser(user.uid);
      }

      this.hasUserChosenSession = true;
      this.chosenSessionType = 'account';
      WattWatchStorage.setActiveUser(user.uid);
      this.currentUser = {
        uid: user.uid,
        username: cleanUsername,
        displayName: rawUsername
      };

      // Save user profile in Firestore under /users/{uid}
      if (this.db && this.setDoc && this.doc) {
        try {
          await this.setDoc(this.doc(this.db, "users", user.uid), {
            username: cleanUsername,
            displayName: rawUsername,
            hasImportedGuestData: shouldImport,
            createdAt: this.serverTimestamp ? this.serverTimestamp() : new Date().toISOString(),
            updatedAt: this.serverTimestamp ? this.serverTimestamp() : new Date().toISOString()
          });
        } catch (e) {
          console.warn('[WattWatch Auth] Error saving user profile to Firestore:', e);
        }
      }

      this.closeModal(true);
      this.updateTopbarState();

      if (typeof WattWatchApp !== 'undefined') {
        if (WattWatchApp.refreshAll) WattWatchApp.refreshAll();
        if (WattWatchApp.showToast) {
          WattWatchApp.showToast(`Account created successfully! Welcome to WattWatch, ${rawUsername}.`, 'success', 'Account Created');
        }
      }
    } catch (err) {
      console.warn('[WattWatch Auth] Signup failed:', err);
      let errMsg = 'Failed to create account. Please try again.';
      if (err.code === 'auth/email-already-in-use') {
        errMsg = `The username "${rawUsername}" is already taken. Please choose another username.`;
      } else if (err.code === 'auth/weak-password') {
        errMsg = 'The password is too weak. Please use at least 8 characters.';
      } else if (err.code === 'auth/network-request-failed') {
        errMsg = 'Network error connecting to authentication service. Please check your internet connection.';
      } else if (err.message && !err.message.includes('Firebase') && !err.message.includes('http') && !err.message.includes('API')) {
        errMsg = err.message;
      }
      this.showAlert(errMsg, 'error');
    } finally {
      this._isSubmitting = false;
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Create Account';
      }
    }
  },

  /**
   * Handles user sign-out and cleanly restores Guest Mode
   */
  async signOut() {
    try {
      if (this.auth && this.firebaseSignOut) {
        await this.firebaseSignOut(this.auth);
      }
    } catch (e) {
      console.warn('[WattWatch Auth] Error signing out from Firebase:', e);
    }

    this.currentUser = null;
    this.hasUserChosenSession = true;
    this.chosenSessionType = 'guest';
    WattWatchStorage.setActiveUser(null);
    this.closeModal(true);
    this.updateTopbarState();

    if (typeof WattWatchApp !== 'undefined') {
      if (WattWatchApp.refreshAll) WattWatchApp.refreshAll();
      if (WattWatchApp.showToast) {
        WattWatchApp.showToast('You have been signed out. Switched to Guest Mode.', 'info', 'Guest Mode');
      }
    }
  },

  /**
   * Handles Recovery form submission
   */
  handleRecoverySubmit() {
    this.clearAlert();
    const usernameInput = document.getElementById('recoveryUsername');

    const uCheck = this.validateUsername(usernameInput ? usernameInput.value : '');
    if (!uCheck.valid) {
      this.showAlert(uCheck.error, 'error');
      if (usernameInput) usernameInput.focus();
      return;
    }

    // Transparently inform the user without claiming fake recovery works
    this.showAlert(
      'WattWatch protects user privacy by using username-only authentication without storing email addresses or phone numbers. Automated password reset is currently unavailable without verified identity recovery services. Please keep your credentials secure, continue in Guest Mode, or register a new username.',
      'info'
    );
  },

  /**
   * Displays an alert message inside the auth modal
   * @param {string} message
   * @param {'info' | 'error' | 'success'} type
   */
  showAlert(message, type = 'info') {
    const alertArea = document.getElementById('authAlertArea');
    if (!alertArea) return;

    const iconSvg = type === 'error'
      ? `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`
      : `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="flex-shrink:0;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`;

    alertArea.className = `auth-alert auth-alert-${type}`;
    alertArea.innerHTML = `${iconSvg}<div>${message}</div>`;
    alertArea.style.display = 'flex';
  },

  /**
   * Clears the alert area inside the auth modal
   */
  clearAlert() {
    const alertArea = document.getElementById('authAlertArea');
    if (alertArea) {
      alertArea.innerHTML = '';
      alertArea.style.display = 'none';
      alertArea.className = '';
    }
  }
};
