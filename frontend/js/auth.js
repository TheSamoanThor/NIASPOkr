// авторизация
class AuthSystem { 
    constructor() {
        this.API_BASE_URL = '/api';
        this.currentUser = null;
        this.init();
    }

    init() {
        this.bindEvents();
        this.checkAuthStatus();
    }

    bindEvents() {
        document.getElementById('showRegister').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('register');
        });

        document.getElementById('showLogin').addEventListener('click', (e) => {
            e.preventDefault();
            this.showForm('login');
        });

        document.getElementById('loginForm').addEventListener('submit', (e) => this.handleLogin(e));
        document.getElementById('registerForm').addEventListener('submit', (e) => this.handleRegister(e));
    }

    showForm(formType) {
        document.getElementById('loginForm').classList.remove('active');
        document.getElementById('registerForm').classList.remove('active');
        
        if (formType === 'login') {
            document.getElementById('loginForm').classList.add('active');
        } else {
            document.getElementById('registerForm').classList.add('active');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const submitButton = e.target.querySelector('.auth-button');
        const originalText = submitButton.textContent;

        try {
            this.setButtonState(submitButton, true, 'Signing in...');

            const loginData = {
                email: document.getElementById('loginEmail').value.trim(),
                password: document.getElementById('loginPassword').value
            };

            if (!this.validateLoginForm(loginData)) {
                return;
            }

            console.log("Attempting login for:", loginData.email);
            
            const response = await fetch(`${this.API_BASE_URL}/auth/login`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(loginData)
            });

            const result = await response.json();

            if (response.ok) {
                console.log("Login successful, redirecting to dashboard");
                this.handleLoginSuccess(result);
            } else {
                throw new Error(result.error || 'Login failed');
            }

        } catch (error) {
            console.error('Login error:', error);
            this.showNotification(error.message || 'Login failed. Please try again.', 'error');
        } finally {
            this.setButtonState(submitButton, false, originalText);
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const submitButton = e.target.querySelector('.auth-button');
        const originalText = submitButton.textContent;

        try {
            this.setButtonState(submitButton, true, 'Requesting access...');

            const registerData = {
                name: document.getElementById('regName').value.trim(),
                email: document.getElementById('regEmail').value.trim(),
                department: document.getElementById('regDepartment').value,
                employee_id: document.getElementById('regEmployeeId').value.trim(),
                password: document.getElementById('regPassword').value,
                confirm_password: document.getElementById('regConfirmPassword').value
            };

            if (!this.validateRegisterForm(registerData)) {
                return;
            }

            const response = await fetch(`${this.API_BASE_URL}/auth/register`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(registerData)
            });

            const result = await response.json();

            if (response.ok) {
                this.showNotification('Access request submitted successfully! You will be notified once approved by administrator.', 'success');
                this.showForm('login');
                document.getElementById('registerForm').reset();
            } else {
                throw new Error(result.error || 'Registration failed');
            }

        } catch (error) {
            console.error('Registration error:', error);
            this.showNotification(error.message || 'Registration failed. Please try again.', 'error');
        } finally {
            this.setButtonState(submitButton, false, originalText);
        }
    }

    validateLoginForm(data) {
        let isValid = true;

        if (!data.email) {
            this.showFieldError('loginEmail', 'Email is required');
            isValid = false;
        } else {
            this.clearFieldError('loginEmail');
        }

        if (!data.password) {
            this.showFieldError('loginPassword', 'Password is required');
            isValid = false;
        } else {
            this.clearFieldError('loginPassword');
        }

        return isValid;
    }

    validateRegisterForm(data) {
        let isValid = true;

        if (!data.name) {
            this.showFieldError('regName', 'Full name is required');
            isValid = false;
        } else if (data.name.length < 2) {
            this.showFieldError('regName', 'Name must be at least 2 characters');
            isValid = false;
        } else {
            this.clearFieldError('regName');
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!data.email) {
            this.showFieldError('regEmail', 'Email is required');
            isValid = false;
        } else if (!emailRegex.test(data.email)) {
            this.showFieldError('regEmail', 'Please enter a valid email address');
            isValid = false;
        } else {
            this.clearFieldError('regEmail');
        }

        if (!data.department) {
            this.showFieldError('regDepartment', 'Please select a department');
            isValid = false;
        } else {
            this.clearFieldError('regDepartment');
        }

        if (!data.employee_id) {
            this.showFieldError('regEmployeeId', 'Employee ID is required');
            isValid = false;
        } else {
            this.clearFieldError('regEmployeeId');
        }

        if (!data.password) {
            this.showFieldError('regPassword', 'Password is required');
            isValid = false;
        } else if (data.password.length < 8) {
            this.showFieldError('regPassword', 'Password must be at least 8 characters');
            isValid = false;
        } else {
            this.clearFieldError('regPassword');
        }

        if (!data.confirm_password) {
            this.showFieldError('regConfirmPassword', 'Please confirm your password');
            isValid = false;
        } else if (data.password !== data.confirm_password) {
            this.showFieldError('regConfirmPassword', 'Passwords do not match');
            isValid = false;
        } else {
            this.clearFieldError('regConfirmPassword');
        }

        return isValid;
    }

    handleLoginSuccess(result) {
        localStorage.setItem('auth_token', result.token);
        localStorage.setItem('user_data', JSON.stringify(result.user));
        
        this.showNotification('Login successful! Redirecting...', 'success');
        
        console.log("Redirecting to dashboard...");
        
        setTimeout(() => {
            window.location.href = 'dashboard.html';
        }, 1500);
    }

    async checkAuthStatus() {
        const token = localStorage.getItem('auth_token');
        const userData = localStorage.getItem('user_data');

        if (token && userData) {
            try {
                console.log("Checking auth status...");
                
                const response = await fetch(`${this.API_BASE_URL}/auth/verify`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });

                if (response.ok) {
                    console.log("Token is valid, redirecting to dashboard");
                    window.location.href = 'dashboard.html';
                } else {
                    console.log("Token invalid, clearing storage");
                    this.logout();
                }
            } catch (error) {
                console.error('Auth verification failed:', error);
                this.logout();
            }
        }
    }

    logout() {
        localStorage.removeItem('auth_token');
        localStorage.removeItem('user_data');
        window.location.href = '/';
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

    setButtonState(button, loading, text) {
        button.disabled = loading;
        button.textContent = text;
    }

    showNotification(message, type = 'info') {
        const existingNotifications = document.querySelectorAll('.notification');
        existingNotifications.forEach(notification => notification.remove());

        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <span>${message}</span>
            <button onclick="this.parentElement.remove()">×</button>
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            if (notification.parentElement) {
                notification.remove();
            }
        }, 5000);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.authSystem = new AuthSystem();
});