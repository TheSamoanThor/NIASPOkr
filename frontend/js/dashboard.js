// управление пользователями
class Dashboard {
    constructor() {
        this.API_BASE_URL = '/api';
        this.currentUser = null;
        this.users = [];
        this.filteredUsers = [];
        this.currentPage = 1;
        this.usersPerPage = 10;
        this.init();
    }

    async init() {
        console.log("Initializing dashboard...");
        
        try {
            await this.checkAuthentication();
            this.bindEvents();
            await this.loadUserData();
            await this.loadUsers();
            this.updateStats();
            console.log("Dashboard initialized successfully");
        } catch (error) {
            console.error("Dashboard initialization failed:", error);
            this.handlePageLoadError();
        }
    }

    async refreshData() {
        console.log('Refreshing data...');
        await this.loadUsers();
        this.updateStats();
    }

    async approveUser(userId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.API_BASE_URL}/users/${userId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'active' })
            });

            if (response.ok) {
                this.showNotification('User approved successfully!', 'success');
                await this.loadUsers();
                this.updateStats();
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Failed to approve user');
            }
        } catch (error) {
            console.error('Error approving user:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async rejectUser(userId) {
        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.API_BASE_URL}/users/${userId}/status`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ status: 'inactive' })
            });

            if (response.ok) {
                this.showNotification('User rejected successfully!', 'success');
                await this.loadUsers();
                this.updateStats();
            } else {
                const result = await response.json();
                throw new Error(result.error || 'Failed to reject user');
            }
        } catch (error) {
            console.error('Error rejecting user:', error);
            this.showNotification(error.message, 'error');
        }
    }

    async checkAuthentication() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        console.log("Checking authentication...");
        console.log("Token exists:", !!token);
        console.log("User data exists:", !!userData);

        if (!token || !userData) {
            console.log("No token or user data, redirecting to login");
            this.redirectToLogin();
            return;
        }

        try {
            console.log("Verifying token...");
            const response = await fetch(`${this.API_BASE_URL}/auth/verify`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            console.log("Auth verify response status:", response.status);

            if (!response.ok) {
                console.log("Token verification failed, status:", response.status);
                await this.fallbackAuthCheck(token);
                return;
            }

            console.log("Token verified successfully");
            const result = await response.json();
            this.currentUser = result.user;
            localStorage.setItem('user_data', JSON.stringify(result.user));
            this.updateUserInterface();

        } catch (error) {
            console.error('Authentication check failed:', error);
            await this.fallbackAuthCheck(token);
        }
    }

    async fallbackAuthCheck(token) {
        try {
            console.log("Trying fallback auth check...");
            const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                localStorage.setItem('user_data', JSON.stringify(userData));
                this.updateUserInterface();
                console.log("Fallback auth check successful");
            } else {
                console.log("Fallback auth check failed");
                this.redirectToLogin();
            }
        } catch (error) {
            console.error('Fallback auth check failed:', error);
            this.redirectToLogin();
        }
    }

    redirectToLogin() {
        console.log("Redirecting to login...");
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }

    updateUserInterface() {
        if (this.currentUser) {
            const userNameElement = document.getElementById('userName');
            const userEmailElement = document.getElementById('userEmail');
            const userRoleElement = document.getElementById('userRole');
            
            if (userNameElement) userNameElement.textContent = this.currentUser.name;
            if (userEmailElement) userEmailElement.textContent = this.currentUser.email;
            if (userRoleElement) userRoleElement.textContent = this.currentUser.role.charAt(0).toUpperCase() + this.currentUser.role.slice(1);
            
            console.log("User interface updated:", this.currentUser.name);
        }
    }

    bindEvents() {
        console.log("Binding events...");
        
        document.getElementById('logoutBtn')?.addEventListener('click', () => this.logout());
        document.getElementById('refreshBtn')?.addEventListener('click', () => this.refreshData());
        document.getElementById('addUserBtn')?.addEventListener('click', () => this.showAddUserModal());
        document.getElementById('closeModal')?.addEventListener('click', () => this.hideAddUserModal());
        document.getElementById('cancelAddUser')?.addEventListener('click', () => this.hideAddUserModal());
        document.getElementById('addUserForm')?.addEventListener('submit', (e) => this.handleAddUser(e));
        document.getElementById('closeEditModal')?.addEventListener('click', () => this.hideEditUserModal());
        document.getElementById('cancelEditUser')?.addEventListener('click', () => this.hideEditUserModal());
        document.getElementById('editUserForm')?.addEventListener('submit', (e) => this.handleEditUser(e));
        document.getElementById('userSearch')?.addEventListener('input', (e) => this.handleSearch(e.target.value));
        document.getElementById('departmentFilter')?.addEventListener('change', (e) => this.applyFilters());
        document.getElementById('roleFilter')?.addEventListener('change', (e) => this.applyFilters());
        document.getElementById('statusFilter')?.addEventListener('change', (e) => this.applyFilters());
        document.getElementById('prevPage')?.addEventListener('click', () => this.previousPage());
        document.getElementById('nextPage')?.addEventListener('click', () => this.nextPage());

        document.getElementById('addUserModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'addUserModal') {
                this.hideAddUserModal();
            }
        });

        document.getElementById('editUserModal')?.addEventListener('click', (e) => {
            if (e.target.id === 'editUserModal') {
                this.hideEditUserModal();
            }
        });

        this.bindPasswordValidation();
        
        console.log("Events bound successfully");
    }

    bindPasswordValidation() {
        const addPassword = document.getElementById('newUserPassword');
        const addConfirmPassword = document.getElementById('newUserConfirmPassword');
        
        if (addPassword && addConfirmPassword) {
            addPassword.addEventListener('input', () => this.checkAddPasswordMatch());
            addConfirmPassword.addEventListener('input', () => this.checkAddPasswordMatch());
        }

        const editPassword = document.getElementById('editUserPassword');
        const editConfirmPassword = document.getElementById('editUserConfirmPassword');
        
        if (editPassword && editConfirmPassword) {
            editPassword.addEventListener('input', () => this.checkEditPasswordMatch());
            editConfirmPassword.addEventListener('input', () => this.checkEditPasswordMatch());
        }
    }

    checkAddPasswordMatch() {
        const password = document.getElementById('newUserPassword').value;
        const confirmPassword = document.getElementById('newUserConfirmPassword').value;
        const confirmInput = document.getElementById('newUserConfirmPassword');
        
        this.clearFieldError('newUserConfirmPassword');
        
        if (confirmPassword && password !== confirmPassword) {
            this.showFieldError('newUserConfirmPassword', 'Passwords do not match');
            confirmInput.setCustomValidity('Passwords do not match');
        } else {
            this.clearFieldError('newUserConfirmPassword');
            confirmInput.setCustomValidity('');
        }
    }

    checkEditPasswordMatch() {
        const password = document.getElementById('editUserPassword').value;
        const confirmPassword = document.getElementById('editUserConfirmPassword').value;
        const confirmInput = document.getElementById('editUserConfirmPassword');
        
        this.clearFieldError('editUserConfirmPassword');
        
        if (confirmPassword && password !== confirmPassword) {
            this.showFieldError('editUserConfirmPassword', 'Passwords do not match');
            confirmInput.setCustomValidity('Passwords do not match');
        } else {
            this.clearFieldError('editUserConfirmPassword');
            confirmInput.setCustomValidity('');
        }
    }

    async loadUserData() {
        try {
            const token = localStorage.getItem('auth_token');
            console.log("Loading user data...");
            
            const response = await fetch(`${this.API_BASE_URL}/auth/me`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                const userData = await response.json();
                this.currentUser = userData;
                localStorage.setItem('user_data', JSON.stringify(userData));
                this.updateUserInterface();
                console.log("User data loaded successfully");
            } else {
                console.error("Failed to load user data");
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }
    }

    async loadUsers() {
        try {
            this.showLoadingState();
            
            const token = localStorage.getItem('auth_token');
            console.log("Loading users list...");
            
            const response = await fetch(`${this.API_BASE_URL}/users`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Cache-Control': 'no-cache'
                }
            });

            console.log("Response status:", response.status);
            
            if (!response.ok) {
                const errorText = await response.text();
                console.error("Error response:", errorText);
                throw new Error(`Failed to load users: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();
            console.log("Users data received:", result);
            
            this.users = result.data || result;
            this.applyFilters();
            this.hideLoadingState();
            console.log(`Loaded ${this.users.length} users`);

        } catch (error) {
            console.error('Error loading users:', error);
            this.showNotification('Failed to load users: ' + error.message, 'error');
            this.hideLoadingState();
        }
    }

    showLoadingState() {
        const tbody = document.getElementById('usersTableBody');
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="loading-state">
                        <div class="spinner"></div>
                        <span>Loading users...</span>
                    </td>
                </tr>
            `;
        }
    }

    hideLoadingState() {
    }

    handleSearch(searchTerm) {
        this.applyFilters();
    }

    applyFilters() {
        const searchTerm = document.getElementById('userSearch')?.value.toLowerCase() || '';
        const departmentFilter = document.getElementById('departmentFilter')?.value || '';
        const roleFilter = document.getElementById('roleFilter')?.value || '';
        const statusFilter = document.getElementById('statusFilter')?.value || '';

        this.filteredUsers = this.users.filter(user => {
            const matchesSearch = !searchTerm || 
                user.name.toLowerCase().includes(searchTerm) ||
                user.email.toLowerCase().includes(searchTerm) ||
                (user.employee_id && user.employee_id.toLowerCase().includes(searchTerm));
            
            const matchesDepartment = !departmentFilter || user.department === departmentFilter;
            const matchesRole = !roleFilter || user.role === roleFilter;
            const matchesStatus = !statusFilter || user.status === statusFilter;

            return matchesSearch && matchesDepartment && matchesRole && matchesStatus;
        });

        this.currentPage = 1;
        this.renderUsers();
        this.updatePagination();
    }

    renderUsers() {
        const tbody = document.getElementById('usersTableBody');
        if (!tbody) {
            console.error("Users table body not found");
            return;
        }

        const startIndex = (this.currentPage - 1) * this.usersPerPage;
        const endIndex = startIndex + this.usersPerPage;
        const usersToShow = this.filteredUsers.slice(startIndex, endIndex);

        if (usersToShow.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="empty-state">
                        <div class="empty-message">
                            <p>No users found</p>
                            <span>Try adjusting your search or filters</span>
                        </div>
                    </td>
                </tr>
            `;
        } else {
            tbody.innerHTML = usersToShow.map(user => {
                let actionButtons = '';
                
                if (user.status === 'pending' && this.currentUser && 
                    (this.currentUser.role === 'admin' || this.currentUser.role === 'manager')) {
                    actionButtons = `
                        <button class="btn-action btn-approve" onclick="dashboard.approveUser(${user.id})">
                            Approve
                        </button>
                        <button class="btn-action btn-reject" onclick="dashboard.rejectUser(${user.id})">
                            Reject
                        </button>
                    `;
                } else {
                    actionButtons = `
                        <button class="btn-action btn-edit" onclick="dashboard.editUser(${user.id})" 
                                ${!this.canEditUser(user) ? 'disabled style="opacity: 0.5; cursor: not-allowed;"' : ''}>
                            Edit
                        </button>
                        ${this.currentUser && this.currentUser.role === 'admin' && user.id !== this.currentUser.id ? `
                            <button class="btn-action btn-delete" onclick="dashboard.deleteUser(${user.id})">
                                Delete
                            </button>
                        ` : ''}
                    `;
                }

                return `
                    <tr>
                        <td>
                            <div class="user-cell">
                                <div class="user-avatar-small">
                                    ${user.name.charAt(0).toUpperCase()}
                                </div>
                                <div class="user-details">
                                    <strong>${this.escapeHtml(user.name)}</strong>
                                    <span>${this.escapeHtml(user.email)}</span>
                                </div>
                            </div>
                        </td>
                        <td>${user.employee_id || 'N/A'}</td>
                        <td>
                            <span class="department-badge">${this.getDepartmentDisplayName(user.department)}</span>
                        </td>
                        <td>
                            <span class="role-badge ${user.role}">${user.role.charAt(0).toUpperCase() + user.role.slice(1)}</span>
                        </td>
                        <td>
                            <span class="status-badge ${user.status || 'pending'}">
                                ${user.status ? user.status.charAt(0).toUpperCase() + user.status.slice(1) : 'Pending'}
                            </span>
                        </td>
                        <td>${user.last_login ? this.formatDate(user.last_login) : 'Never'}</td>
                        <td>
                            <div class="action-buttons">
                                ${actionButtons}
                            </div>
                        </td>
                    </tr>
                `;
            }).join('');
        }

        const showingCountElement = document.getElementById('showingCount');
        const totalCountElement = document.getElementById('totalCount');
        if (showingCountElement) showingCountElement.textContent = usersToShow.length;
        if (totalCountElement) totalCountElement.textContent = this.filteredUsers.length;
    }

    canEditUser(user) {
        if (!this.currentUser) return false;
        return this.currentUser.id === user.id || 
               this.currentUser.role === 'admin' || 
               this.currentUser.role === 'manager';
    }

    updatePagination() {
        const totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
        const prevButton = document.getElementById('prevPage');
        const nextButton = document.getElementById('nextPage');
        const currentPageElement = document.getElementById('currentPage');

        if (currentPageElement) currentPageElement.textContent = this.currentPage;

        if (prevButton) prevButton.disabled = this.currentPage === 1;
        if (nextButton) nextButton.disabled = this.currentPage === totalPages || totalPages === 0;
    }

    previousPage() {
        if (this.currentPage > 1) {
            this.currentPage--;
            this.renderUsers();
            this.updatePagination();
        }
    }

    nextPage() {
        const totalPages = Math.ceil(this.filteredUsers.length / this.usersPerPage);
        if (this.currentPage < totalPages) {
            this.currentPage++;
            this.renderUsers();
            this.updatePagination();
        }
    }

    showAddUserModal() {
        if (!this.currentUser || (this.currentUser.role !== 'admin' && this.currentUser.role !== 'manager')) {
            this.showNotification('You do not have permission to add users', 'error');
            return;
        }

        const modal = document.getElementById('addUserModal');
        if (modal) {
            modal.classList.add('active');
            document.getElementById('addUserForm')?.reset();
            
            const passwordField = document.getElementById('newUserPassword');
            const confirmPasswordField = document.getElementById('newUserConfirmPassword');
            
            if (passwordField) passwordField.value = '';
            if (confirmPasswordField) confirmPasswordField.value = '';
            
            this.clearFieldError('newUserConfirmPassword');
        }
    }

    hideAddUserModal() {
        const modal = document.getElementById('addUserModal');
        if (modal) modal.classList.remove('active');
    }

    async handleAddUser(e) {
        e.preventDefault();

        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            this.setButtonState(submitButton, true, 'Creating...');

            const userData = {
                name: document.getElementById('newUserName').value.trim(),
                email: document.getElementById('newUserEmail').value.trim(),
                department: document.getElementById('newUserDepartment').value,
                employee_id: document.getElementById('newUserEmployeeId').value.trim(),
                role: document.getElementById('newUserRole').value,
                status: document.getElementById('newUserStatus').value,
                password: document.getElementById('newUserPassword').value,
                confirm_password: document.getElementById('newUserConfirmPassword').value
            };

            console.log("Creating user with data:", userData);

            if (!userData.name || !userData.email || !userData.department || !userData.role || !userData.employee_id) {
                throw new Error('All required fields are required');
            }

            const password = userData.password;
            const confirmPassword = userData.confirm_password;
            
            if (password && password.trim()) {
                if (password.length < 8) {
                    throw new Error('Password must be at least 8 characters long');
                }
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                console.log("Custom password will be used");
            } else {
                delete userData.password;
                delete userData.confirm_password;
                console.log("Temporary password will be generated");
            }

            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.API_BASE_URL}/users`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok) {
                let message = 'User created successfully!';
                if (result.temp_password) {
                    message += ` Temporary password: ${result.temp_password}`;
                } else {
                    message += ' Custom password has been set.';
                }
                this.showNotification(message, 'success');
                this.hideAddUserModal();
                await this.loadUsers();
                this.updateStats();
            } else {
                throw new Error(result.error || 'Failed to create user');
            }

        } catch (error) {
            console.error('Error creating user:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.setButtonState(submitButton, false, originalText);
        }
    }

    async editUser(userId) {
        const user = this.users.find(u => u.id === userId);
        if (!user) {
            this.showNotification('User not found', 'error');
            return;
        }

        if (!this.canEditUser(user)) {
            this.showNotification('You do not have permission to edit this user', 'error');
            return;
        }

        this.showEditUserModal(user);
    }

    showEditUserModal(user) {
        document.getElementById('editUserId').value = user.id;
        document.getElementById('editUserName').value = user.name;
        document.getElementById('editUserEmail').value = user.email;
        document.getElementById('editUserEmployeeId').value = user.employee_id || '';
        document.getElementById('editUserDepartment').value = user.department;
        document.getElementById('editUserRole').value = user.role;
        document.getElementById('editUserStatus').value = user.status || 'active';

        document.getElementById('editUserPassword').value = '';
        document.getElementById('editUserConfirmPassword').value = '';
        this.clearFieldError('editUserConfirmPassword');

        this.updatePasswordHint();

        const canEditRole = this.currentUser?.role === 'admin';
        const canEditStatus = this.currentUser?.role === 'admin' || this.currentUser?.role === 'manager';
        const canEditEmployeeId = this.currentUser?.role === 'admin' || this.currentUser?.role === 'manager';
        
        const roleGroup = document.getElementById('editUserRole').closest('.form-group');
        const statusGroup = document.getElementById('editUserStatus').closest('.form-group');
        const employeeIdGroup = document.getElementById('editUserEmployeeId').closest('.form-group');
        const departmentGroup = document.getElementById('editUserDepartment').closest('.form-group');
        
        if (roleGroup) roleGroup.style.display = canEditRole ? 'block' : 'none';
        if (statusGroup) statusGroup.style.display = canEditStatus ? 'block' : 'none';
        if (employeeIdGroup) employeeIdGroup.style.display = canEditEmployeeId ? 'block' : 'none';
        if (departmentGroup) departmentGroup.style.display = canEditEmployeeId ? 'block' : 'none';

        const modal = document.getElementById('editUserModal');
        if (modal) modal.classList.add('active');
    }

    updatePasswordHint() {
        const passwordInput = document.getElementById('editUserPassword');
        const passwordGroup = passwordInput?.closest('.form-group');
        
        if (passwordGroup) {
            const oldHint = passwordGroup.querySelector('.password-hint');
            if (oldHint) {
                oldHint.remove();
            }
            
            const hint = document.createElement('div');
            hint.className = 'password-hint form-help';
            hint.textContent = 'Leave empty to keep current password';
            hint.style.color = '#666';
            hint.style.fontSize = '0.8rem';
            hint.style.marginTop = '5px';
            
            passwordGroup.appendChild(hint);
        }
    }

    hideEditUserModal() {
        const modal = document.getElementById('editUserModal');
        if (modal) modal.classList.remove('active');
    }

    async handleEditUser(e) {
        e.preventDefault();

        const submitButton = e.target.querySelector('button[type="submit"]');
        const originalText = submitButton.textContent;

        try {
            this.setButtonState(submitButton, true, 'Updating...');

            const userData = {
                name: document.getElementById('editUserName').value.trim(),
                email: document.getElementById('editUserEmail').value.trim(),
                employee_id: document.getElementById('editUserEmployeeId').value.trim(),
                department: document.getElementById('editUserDepartment').value,
                role: document.getElementById('editUserRole').value,
                status: document.getElementById('editUserStatus').value,
                password: document.getElementById('editUserPassword').value,
                confirm_password: document.getElementById('editUserConfirmPassword').value
            };

            console.log("Updating user with data:", userData);

            const userId = document.getElementById('editUserId').value;

            if (!userData.name || !userData.email || !userData.department) {
                throw new Error('All required fields must be filled');
            }

            const password = userData.password;
            const confirmPassword = userData.confirm_password;
            
            if (password && password.trim()) {
                if (password.length < 8) {
                    throw new Error('Password must be at least 8 characters long');
                }
                if (password !== confirmPassword) {
                    throw new Error('Passwords do not match');
                }
                console.log("Password will be updated");
            } else {
                delete userData.password;
                delete userData.confirm_password;
                console.log("No password change requested");
            }

            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.API_BASE_URL}/users/${userId}`, {
                method: 'PUT',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });

            const result = await response.json();

            if (response.ok) {
                let message = 'User updated successfully!';
                if (userData.password) {
                    message += ' Password has been updated.';
                }
                this.showNotification(message, 'success');
                this.hideEditUserModal();
                await this.loadUsers();
                this.updateStats();
            } else {
                throw new Error(result.error || 'Failed to update user');
            }

        } catch (error) {
            console.error('Error updating user:', error);
            this.showNotification(error.message, 'error');
        } finally {
            this.setButtonState(submitButton, false, originalText);
        }
    }

    async deleteUser(userId) {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            const token = localStorage.getItem('auth_token');
            const response = await fetch(`${this.API_BASE_URL}/users/${userId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (response.ok) {
                this.showNotification('User deleted successfully!', 'success');
                await this.loadUsers();
                this.updateStats();
            } else {
                throw new Error('Failed to delete user');
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            this.showNotification('Failed to delete user', 'error');
        }
    }

    updateStats() {
        const totalUsers = this.users.length;
        const activeUsers = this.users.filter(user => user.status === 'active').length;
        const pendingUsers = this.users.filter(user => user.status === 'pending').length;
        const adminCount = this.users.filter(user => user.role === 'admin').length;

        const totalUsersElement = document.getElementById('totalUsers');
        const activeUsersElement = document.getElementById('activeUsers');
        const newUsersElement = document.getElementById('newUsers');
        const adminCountElement = document.getElementById('adminCount');

        if (totalUsersElement) totalUsersElement.textContent = totalUsers;
        if (activeUsersElement) activeUsersElement.textContent = activeUsers;
        if (newUsersElement) newUsersElement.textContent = pendingUsers;
        if (adminCountElement) adminCountElement.textContent = adminCount;
        
        console.log("Stats updated");
    }

    logout() {
        console.log("Logging out...");
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
    }

    handlePageLoadError() {
        console.error("Failed to load dashboard page");
        
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #e74c3c;
            color: white;
            padding: 15px 20px;
            border-radius: 5px;
            z-index: 10000;
            text-align: center;
        `;
        notification.innerHTML = `
            <strong>Ошибка загрузки</strong><br>
            Не удалось загрузить dashboard. Попробуйте обновить страницу.
            <button onclick="this.parentElement.remove()" style="margin-left: 10px; background: none; border: none; color: white; cursor: pointer">×</button>
        `;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (confirm('Не удалось загрузить dashboard. Вернуться на страницу входа?')) {
                this.redirectToLogin();
            }
        }, 3000);
    }

    getDepartmentDisplayName(dept) {
        const departments = {
            'hr': 'Human Resources',
            'it': 'IT Department',
            'finance': 'Finance',
            'sales': 'Sales',
            'marketing': 'Marketing',
            'general': 'General'
        };
        return departments[dept] || dept;
    }

    formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        } catch (e) {
            return 'Invalid Date';
        }
    }

    escapeHtml(unsafe) {
        return unsafe
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    setButtonState(button, loading, text) {
        button.disabled = loading;
        button.textContent = text;
    }

    showNotification(message, type = 'info') {
        const container = document.getElementById('notificationsContainer');
        if (!container) return;
        
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;

        container.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }

    showFieldError(fieldId, message) {
        this.clearFieldError(fieldId);
        
        const field = document.getElementById(fieldId);
        field.classList.add('error');
        
        const errorDiv = document.createElement('div');
        errorDiv.className = 'field-error';
        errorDiv.textContent = message;
        field.parentNode.appendChild(errorDiv);
    }

    clearFieldError(fieldId) {
        const field = document.getElementById(fieldId);
        field.classList.remove('error');
        
        const existingError = field.parentNode.querySelector('.field-error');
        if (existingError) {
            existingError.remove();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM loaded, initializing dashboard...");
    window.dashboard = new Dashboard();
});