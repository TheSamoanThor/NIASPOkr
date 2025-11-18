from flask import Flask, request, jsonify
from flask_sqlalchemy import SQLAlchemy
from flask_cors import CORS
import os
import redis
from datetime import datetime, timedelta
import jwt
import bcrypt
from functools import wraps
import secrets
import string
import time
from sqlalchemy.exc import OperationalError

app = Flask(__name__)
CORS(app, origins=["http://localhost", "http://localhost:80", "http://127.0.0.1", "http://127.0.0.1:80"])

app.config['SQLALCHEMY_DATABASE_URI'] = 'postgresql://user:password@database:5432/auth_system'
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = '1234567890longSK'
app.config['JWT_SECRET'] = '1234567890longTWT'
app.config['JWT_EXPIRATION_HOURS'] = 24

db = SQLAlchemy(app)

def get_redis_connection():
    max_retries = 5
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            redis_client = redis.Redis(
                host='cache',
                port=6379, 
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )
            redis_client.ping()
            return redis_client
        except (redis.ConnectionError, redis.TimeoutError) as e:
            if attempt < max_retries - 1:
                print(f"Redis connection failed, retrying in {retry_delay}s... ({attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
            else:
                print(f"Failed to connect to Redis after {max_retries} attempts: {e}")
                return None

redis_client = get_redis_connection()

class User(db.Model):
    __tablename__ = 'users'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    email = db.Column(db.String(100), unique=True, nullable=False)
    department = db.Column(db.String(50), nullable=False)
    employee_id = db.Column(db.String(50), unique=True, nullable=False)
    role = db.Column(db.String(20), default='user')
    status = db.Column(db.String(20), default='pending')
    password_hash = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_login = db.Column(db.DateTime)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def set_password(self, password):
        salt = bcrypt.gensalt()
        self.password_hash = bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

    def check_password(self, password):
        if not self.password_hash:
            return False
        try:
            return bcrypt.checkpw(password.encode('utf-8'), self.password_hash.encode('utf-8'))
        except Exception as e:
            print(f"Error checking password: {e}")
            return False

    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'department': self.department,
            'employee_id': self.employee_id,
            'role': self.role,
            'status': self.status,
            'created_at': self.created_at.isoformat(),
            'last_login': self.last_login.isoformat() if self.last_login else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None
        }

app_initialized = False

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = None
        
        if 'Authorization' in request.headers:
            try:
                auth_header = request.headers['Authorization']
                token = auth_header.split(' ')[1]
            except IndexError:
                return jsonify({'error': 'Invalid authorization header'}), 401
        
        if not token:
            return jsonify({'error': 'Token is missing'}), 401
        
        try:
            data = jwt.decode(token, app.config['JWT_SECRET'], algorithms=['HS256'])
            current_user = db.session.get(User, data['user_id'])
            
            if not current_user:
                return jsonify({'error': 'User not found'}), 401
                
            if current_user.status != 'active':
                return jsonify({'error': 'Account is not active. Please wait for administrator approval.'}), 401
                
        except jwt.ExpiredSignatureError:
            return jsonify({'error': 'Token has expired'}), 401
        except jwt.InvalidTokenError:
            return jsonify({'error': 'Invalid token'}), 401
        
        return f(current_user, *args, **kwargs)
    
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(current_user, *args, **kwargs):
        if current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Admin privileges required'}), 403
        return f(current_user, *args, **kwargs)
    return decorated

@app.route('/api/users', methods=['GET'])
@token_required
def get_users(current_user):
    try:
        if redis_client:
            cache_key = f'users:{current_user.id}'
            try:
                cached_users = redis_client.get(cache_key)
                if cached_users:
                    return jsonify({'data': eval(cached_users), 'source': 'cache'})
            except Exception as e:
                print(f"Redis cache read failed: {e}")
        
        if current_user.role in ['admin', 'manager']:
            users = User.query.order_by(User.created_at.desc()).all()
        else:
            users = [current_user]
        
        users_list = [user.to_dict() for user in users]
        
        if redis_client:
            try:
                redis_client.setex(cache_key, 30, str(users_list))
            except Exception as e:
                print(f"Redis cache write failed: {e}")
        
        return jsonify({'data': users_list, 'source': 'database'})
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/users', methods=['POST'])
@token_required
@admin_required
def create_user(current_user):
    try:
        data = request.get_json()
        
        if not data or not data.get('name') or not data.get('email'):
            return jsonify({'error': 'Name and email are required'}), 400
        
        existing_user = User.query.filter_by(email=data['email']).first()
        if existing_user:
            return jsonify({'error': 'User with this email already exists'}), 400
        
        new_user = User(
            name=data['name'].strip(),
            email=data['email'].strip().lower(),
            department=data.get('department', 'general'),
            employee_id=data.get('employee_id', f'EMP{User.query.count() + 1:04d}'),
            role=data.get('role', 'user'),
            status=data.get('status', 'active')
        )
        
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if password and password.strip():
            if len(password) < 8:
                return jsonify({'error': 'Password must be at least 8 characters long'}), 400
            if password != confirm_password:
                return jsonify({'error': 'Passwords do not match'}), 400
            new_user.set_password(password)
            temp_password = None
            print(f"Setting custom password for user: {data['email']}")
        else:
            temp_password = ''.join(secrets.choice(string.ascii_letters + string.digits) for _ in range(12))
            new_user.set_password(temp_password)
            print(f"Setting temporary password for user: {data['email']}")
        
        db.session.add(new_user)
        db.session.commit()
        
        if redis_client:
            try:
                redis_client.delete('users:*')
            except Exception as e:
                print(f"Redis cache invalidation failed: {e}")
        
        response_data = {
            'message': 'User created successfully',
            'user': new_user.to_dict()
        }
        if temp_password:
            response_data['temp_password'] = temp_password
        
        return jsonify(response_data), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['DELETE'])
@token_required
@admin_required
def delete_user(current_user, user_id):
    try:
        if current_user.id == user_id:
            return jsonify({'error': 'Cannot delete your own account'}), 400
            
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        user_data = user.to_dict()
        db.session.delete(user)
        db.session.commit()
        
        if redis_client:
            try:
                redis_client.delete('users:*')
            except Exception as e:
                print(f"Redis cache invalidation failed: {e}")
        
        return jsonify({'message': 'User deleted successfully'}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>', methods=['PUT'])
@token_required
def update_user(current_user, user_id):
    try:
        if current_user.id != user_id and current_user.role not in ['admin', 'manager']:
            return jsonify({'error': 'Access denied'}), 403
            
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        
        if 'name' in data:
            user.name = data['name'].strip()
        
        if 'email' in data and data['email'] != user.email:
            existing = User.query.filter_by(email=data['email']).first()
            if existing and existing.id != user_id:
                return jsonify({'error': 'Email already in use'}), 400
            user.email = data['email'].strip().lower()
        
        if 'department' in data and current_user.role in ['admin', 'manager']:
            user.department = data['department']
        
        if 'role' in data and current_user.role == 'admin':
            user.role = data['role']
        
        if 'status' in data and current_user.role in ['admin', 'manager']:
            user.status = data['status']
        
        if 'employee_id' in data and current_user.role in ['admin', 'manager']:
            existing = User.query.filter_by(employee_id=data['employee_id']).first()
            if existing and existing.id != user_id:
                return jsonify({'error': 'Employee ID already in use'}), 400
            user.employee_id = data['employee_id'].strip()
        
        password = data.get('password')
        confirm_password = data.get('confirm_password')
        
        if password and password.strip():
            if len(password) < 8:
                return jsonify({'error': 'Password must be at least 8 characters long'}), 400
            if password != confirm_password:
                return jsonify({'error': 'Passwords do not match'}), 400
            user.set_password(password)
            print(f"Password updated for user: {user.email}")
        
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        if redis_client:
            try:
                redis_client.delete('users:*')
            except Exception as e:
                print(f"Redis cache invalidation failed: {e}")
        
        return jsonify({
            'message': 'User updated successfully',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/users/<int:user_id>/status', methods=['PUT'])
@token_required
@admin_required
def update_user_status(current_user, user_id):
    try:
        user = db.session.get(User, user_id)
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        if 'status' not in data:
            return jsonify({'error': 'Status is required'}), 400
        
        valid_statuses = ['active', 'pending', 'inactive']
        if data['status'] not in valid_statuses:
            return jsonify({'error': 'Invalid status'}), 400
        
        user.status = data['status']
        user.updated_at = datetime.utcnow()
        db.session.commit()
        
        if redis_client:
            try:
                redis_client.delete('users:*')
            except Exception as e:
                print(f"Redis cache invalidation failed: {e}")
        
        return jsonify({
            'message': f'User status updated to {data["status"]}',
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/health')
def health_check():
    global app_initialized
    
    try:
        db.session.execute('SELECT 1')
        db_healthy = True
    except Exception as e:
        db_healthy = False
    
    redis_healthy = False
    if redis_client:
        try:
            redis_client.ping()
            redis_healthy = True
        except Exception as e:
            pass
    
    if app_initialized:
        return jsonify({
            'status': 'healthy',
            'service': 'users',
            'database': 'connected' if db_healthy else 'disconnected',
            'redis': 'connected' if redis_healthy else 'disconnected',
            'initialized': True,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    else:
        return jsonify({
            'status': 'initializing',
            'service': 'users', 
            'database': 'connected' if db_healthy else 'disconnected',
            'redis': 'connected' if redis_healthy else 'disconnected',
            'initialized': False,
            'timestamp': datetime.utcnow().isoformat()
        }), 200

@app.route('/')
def index():
    return jsonify({
        'message': 'User Service - Company Auth System API',
        'service': 'user_management',
        'version': '1.0.0'
    })

def init_db():
    global app_initialized
    
    max_retries = 30
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            with app.app_context():
                inspector = db.inspect(db.engine)
                if inspector.has_table('users'):
                    print("User database tables already exist")
                    app_initialized = True
                    return
                else:
                    print(f"Table 'users' not found, waiting... ({attempt + 1}/{max_retries})")
                    time.sleep(retry_delay)
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Database not ready, retrying in {retry_delay}s... ({attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
            else:
                print("Failed to connect to database after multiple attempts")
                raise e
    
    print("Table 'users' not found after multiple attempts - service may not function properly")
    app_initialized = True

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)