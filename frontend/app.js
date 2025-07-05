// Family Chores App - Main JavaScript Application
function familyChoresApp() {
    return {
        // State
        loading: true,
        isAuthenticated: false,
        user: null,
        token: null,
        activeTab: 'dashboard',
        
        // Login state
        loginStep: 'family', // 'family' or 'user'
        familyCode: '',
        familyInfo: null,
        familyMembers: [],
        loginLoading: false,
        
        // Registration state
        showRegisterFamily: false,
        registerForm: {
            name: '',
            admin_email: ''
        },
        registerLoading: false,
        
        // Data
        currentChores: [],
        allChores: [],
        recentTasks: [],
        
        // Modals
        showSubmitModal: false,
        selectedChore: null,
        submitForm: {
            notes: '',
            photo: null
        },
        submitLoading: false,
        
        showAddMemberModal: false,
        newMember: {
            name: '',
            role: 'child',
            email: ''
        },
        addMemberLoading: false,
        
        // Create chore
        newChore: {
            title: '',
            description: '',
            reward_type: 'money',
            reward_amount: '',
            requires_photo: false,
            acceptance_timer: 5
        },
        createChoreLoading: false,
        
        // Notifications
        notification: {
            show: false,
            type: 'info',
            title: '',
            message: ''
        },

        // API Base URL
        get apiUrl() {
            return window.location.origin + '/api';
        },

        // Initialize app
        async init() {
            console.log('Initializing Family Chores App...');
            
            // Check for existing token
            const savedToken = localStorage.getItem('family_chores_token');
            if (savedToken) {
                this.token = savedToken;
                try {
                    await this.verifyToken();
                } catch (error) {
                    console.error('Token verification failed:', error);
                    this.logout();
                }
            }
            
            this.loading = false;
        },

        // API Helper
        async apiCall(endpoint, options = {}) {
            const url = `${this.apiUrl}${endpoint}`;
            const config = {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            };

            if (this.token && !config.headers.Authorization) {
                config.headers.Authorization = `Bearer ${this.token}`;
            }

            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.message || `HTTP ${response.status}`);
            }

            return response.json();
        },

        // Authentication
        async verifyToken() {
            try {
                const data = await this.apiCall('/auth/verify');
                if (data.valid && data.user) {
                    this.user = data.user;
                    this.isAuthenticated = true;
                    await this.loadDashboardData();
                } else {
                    throw new Error('Invalid token');
                }
            } catch (error) {
                this.logout();
                throw error;
            }
        },

        async loginWithFamilyCode() {
            if (!this.familyCode.trim()) return;
            
            this.loginLoading = true;
            try {
                const data = await this.apiCall('/auth/family/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        family_code: this.familyCode.toUpperCase()
                    })
                });

                this.familyInfo = data.family;
                this.familyMembers = data.members;
                this.loginStep = 'user';
                
                this.showNotification('success', 'Family Found', `Connected to ${data.family.name}`);
            } catch (error) {
                this.showNotification('error', 'Login Failed', error.message);
            } finally {
                this.loginLoading = false;
            }
        },

        async selectUser(member) {
            try {
                const data = await this.apiCall('/auth/user/login', {
                    method: 'POST',
                    body: JSON.stringify({
                        family_code: this.familyCode.toUpperCase(),
                        user_id: member.id
                    })
                });

                this.token = data.token;
                this.user = data.user;
                this.isAuthenticated = true;
                
                localStorage.setItem('family_chores_token', this.token);
                
                await this.loadDashboardData();
                this.showNotification('success', 'Welcome!', `Logged in as ${data.user.name}`);
            } catch (error) {
                this.showNotification('error', 'Login Failed', error.message);
            }
        },

        goBackToFamilyLogin() {
            this.loginStep = 'family';
            this.familyInfo = null;
            this.familyMembers = [];
        },

        async registerFamily() {
            if (!this.registerForm.name || !this.registerForm.admin_email) return;
            
            this.registerLoading = true;
            try {
                const data = await this.apiCall('/families/register', {
                    method: 'POST',
                    body: JSON.stringify(this.registerForm)
                });

                this.showNotification('success', 'Family Registered!', 
                    `Your family code is: ${data.family.family_code}`);
                
                this.familyCode = data.family.family_code;
                this.showRegisterFamily = false;
                this.registerForm = { name: '', admin_email: '' };
                
                // Don't auto-login, just show the family code for manual login
                this.showNotification('success', 'Family Registered!', 
                    `Your family code is: ${data.family.family_code}. Please enter it to continue.`);
            } catch (error) {
                this.showNotification('error', 'Registration Failed', error.message);
            } finally {
                this.registerLoading = false;
            }
        },

        logout() {
            this.token = null;
            this.user = null;
            this.isAuthenticated = false;
            this.activeTab = 'dashboard';
            this.loginStep = 'family';
            this.familyCode = '';
            this.familyInfo = null;
            this.familyMembers = [];
            this.currentChores = [];
            this.allChores = [];
            this.recentTasks = [];
            
            localStorage.removeItem('family_chores_token');
            this.showNotification('info', 'Logged Out', 'You have been logged out successfully');
        },

        // Data Loading
        async loadDashboardData() {
            try {
                await Promise.all([
                    this.loadCurrentChores(),
                    this.loadAllChores(),
                    this.loadRecentTasks(),
                    this.loadFamilyMembers()
                ]);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
                this.showNotification('error', 'Loading Error', 'Failed to load some data');
            }
        },

        async loadCurrentChores() {
            try {
                const data = await this.apiCall('/users/chores');
                this.currentChores = data.chores.filter(chore => 
                    ['pending_acceptance', 'assigned', 'auto_accepted', 'pending_approval'].includes(chore.status)
                );
            } catch (error) {
                console.error('Error loading current chores:', error);
            }
        },

        async loadAllChores() {
            try {
                const data = await this.apiCall('/chores');
                this.allChores = data.chores;
            } catch (error) {
                console.error('Error loading all chores:', error);
            }
        },

        async loadRecentTasks() {
            try {
                const data = await this.apiCall('/users/profile');
                this.recentTasks = data.completed_tasks || [];
                
                // Update user earnings
                if (data.user) {
                    this.user.earnings = data.user.earnings;
                }
            } catch (error) {
                console.error('Error loading recent tasks:', error);
            }
        },

        async loadFamilyMembers() {
            try {
                const data = await this.apiCall('/users/family/members');
                this.familyMembers = data.members.sort((a, b) => {
                    // Sort by earnings (highest first) for leaderboard
                    return parseFloat(b.earnings || 0) - parseFloat(a.earnings || 0);
                });
            } catch (error) {
                console.error('Error loading family members:', error);
            }
        },

        async refreshData() {
            await this.loadDashboardData();
            this.showNotification('success', 'Refreshed', 'Data has been updated');
        },

        // Chore Actions
        async acceptChore(choreId) {
            try {
                await this.apiCall(`/chores/${choreId}/accept`, {
                    method: 'POST'
                });
                
                await this.loadCurrentChores();
                await this.loadAllChores();
                this.showNotification('success', 'Chore Accepted', 'You can now start working on this chore');
            } catch (error) {
                this.showNotification('error', 'Accept Failed', error.message);
            }
        },

        async declineChore(choreId) {
            try {
                await this.apiCall(`/chores/${choreId}/decline`, {
                    method: 'POST'
                });
                
                await this.loadCurrentChores();
                await this.loadAllChores();
                this.showNotification('info', 'Chore Declined', 'Chore has been passed to the next child');
            } catch (error) {
                this.showNotification('error', 'Decline Failed', error.message);
            }
        },

        async assignChore(choreId) {
            try {
                const data = await this.apiCall(`/chores/${choreId}/assign`, {
                    method: 'POST'
                });
                
                await this.loadAllChores();
                this.showNotification('success', 'Chore Assigned', 
                    `Chore assigned to ${data.assigned_to}`);
            } catch (error) {
                this.showNotification('error', 'Assignment Failed', error.message);
            }
        },

        // Submit Chore Modal
        openSubmitModal(chore) {
            this.selectedChore = chore;
            this.submitForm = { notes: '', photo: null };
            this.showSubmitModal = true;
        },

        closeSubmitModal() {
            this.showSubmitModal = false;
            this.selectedChore = null;
            this.submitForm = { notes: '', photo: null };
        },

        handlePhotoUpload(event) {
            const file = event.target.files[0];
            if (file) {
                this.submitForm.photo = file;
            }
        },

        async submitChore() {
            if (!this.selectedChore) return;
            
            this.submitLoading = true;
            try {
                const formData = new FormData();
                formData.append('notes', this.submitForm.notes);
                
                if (this.submitForm.photo) {
                    formData.append('photo', this.submitForm.photo);
                }

                await this.apiCall(`/chores/${this.selectedChore.id}/submit`, {
                    method: 'POST',
                    headers: {
                        // Remove Content-Type to let browser set it with boundary for FormData
                        Authorization: `Bearer ${this.token}`
                    },
                    body: formData
                });

                await this.loadCurrentChores();
                await this.loadAllChores();
                this.closeSubmitModal();
                this.showNotification('success', 'Chore Submitted', 
                    'Your chore has been submitted for approval');
            } catch (error) {
                this.showNotification('error', 'Submission Failed', error.message);
            } finally {
                this.submitLoading = false;
            }
        },

        // Create Chore
        async createChore() {
            this.createChoreLoading = true;
            try {
                await this.apiCall('/chores', {
                    method: 'POST',
                    body: JSON.stringify(this.newChore)
                });

                await this.loadAllChores();
                this.newChore = {
                    title: '',
                    description: '',
                    reward_type: 'money',
                    reward_amount: '',
                    requires_photo: false,
                    acceptance_timer: 5
                };
                
                this.showNotification('success', 'Chore Created', 
                    'New chore has been created successfully');
            } catch (error) {
                this.showNotification('error', 'Creation Failed', error.message);
            } finally {
                this.createChoreLoading = false;
            }
        },

        // Family Management
        async addFamilyMember() {
            this.addMemberLoading = true;
            try {
                await this.apiCall(`/families/${this.user.family_id}/members`, {
                    method: 'POST',
                    body: JSON.stringify(this.newMember)
                });

                await this.loadFamilyMembers();
                this.newMember = { name: '', role: 'child', email: '' };
                this.showAddMemberModal = false;
                
                this.showNotification('success', 'Member Added', 
                    'New family member has been added successfully');
            } catch (error) {
                this.showNotification('error', 'Add Failed', error.message);
            } finally {
                this.addMemberLoading = false;
            }
        },

        // Notifications
        showNotification(type, title, message) {
            this.notification = {
                show: true,
                type,
                title,
                message
            };

            // Auto-hide after 5 seconds
            setTimeout(() => {
                this.hideNotification();
            }, 5000);
        },

        hideNotification() {
            this.notification.show = false;
        },

        // Utilities
        formatDate(dateString) {
            const date = new Date(dateString);
            const now = new Date();
            const diffTime = Math.abs(now - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays === 1) {
                return 'Yesterday';
            } else if (diffDays < 7) {
                return `${diffDays} days ago`;
            } else {
                return date.toLocaleDateString();
            }
        },

        formatCurrency(amount) {
            return parseFloat(amount || 0).toFixed(2);
        },

        // Placeholder functions for future features
        viewSubmissions(chore) {
            this.showNotification('info', 'Coming Soon', 
                'Submission review feature will be available soon');
        }
    };
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then((registration) => {
                console.log('SW registered: ', registration);
            })
            .catch((registrationError) => {
                console.log('SW registration failed: ', registrationError);
            });
    });
}

// Handle offline/online status
window.addEventListener('online', () => {
    console.log('App is online');
});

window.addEventListener('offline', () => {
    console.log('App is offline');
});
