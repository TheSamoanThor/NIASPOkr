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

def generate_token(user):
    payload = {
        'user_id': user.id,
        'email': user.email,
        'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS'])
    }
    return jwt.encode(payload, app.config['JWT_SECRET'], algorithm='HS256')

@app.route('/api/auth/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        
        required_fields = ['name', 'email', 'department', 'employee_id', 'password', 'confirm_password']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'error': f'{field.replace("_", " ").title()} is required'}), 400
        
        if data['password'] != data['confirm_password']:
            return jsonify({'error': 'Passwords do not match'}), 400
        
        if len(data['password']) < 8:
            return jsonify({'error': 'Password must be at least 8 characters long'}), 400
        
        existing_user = User.query.filter(
            (User.email == data['email']) | (User.employee_id == data['employee_id'])
        ).first()
        
        if existing_user:
            return jsonify({'error': 'User with this email or employee ID already exists'}), 400
        
        new_user = User(
            name=data['name'].strip(),
            email=data['email'].strip().lower(),
            department=data['department'],
            employee_id=data['employee_id'].strip(),
            status='pending'
        )
        new_user.set_password(data['password'])
        
        if User.query.count() == 0:
            new_user.role = 'admin'
            new_user.status = 'active'
        
        db.session.add(new_user)
        db.session.commit()
        
        return jsonify({
            'message': 'Access request submitted successfully! You will be notified once approved by administrator.',
            'user': new_user.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        
        if not data.get('email') or not data.get('password'):
            return jsonify({'error': 'Email and password are required'}), 400
        
        user = User.query.filter_by(email=data['email'].lower()).first()
        
        if not user or not user.check_password(data['password']):
            return jsonify({'error': 'Invalid email or password'}), 401
        
        if user.status != 'active':
            return jsonify({'error': 'Your account is pending approval by administrator'}), 401
        
        token = generate_token(user)
        
        user.last_login = datetime.utcnow()
        db.session.commit()
        
        if redis_client:
            try:
                redis_client.delete('users:*')
            except Exception as e:
                print(f"Redis cache invalidation failed: {e}")
        
        return jsonify({
            'message': 'Login successful',
            'token': token,
            'user': user.to_dict()
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/auth/verify', methods=['GET'])
@token_required
def verify_token(current_user):
    return jsonify({
        'message': 'Token is valid',
        'user': current_user.to_dict()
    }), 200

@app.route('/api/auth/me', methods=['GET'])
@token_required
def get_current_user(current_user):
    return jsonify(current_user.to_dict()), 200

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
            'service': 'auth',
            'database': 'connected' if db_healthy else 'disconnected',
            'redis': 'connected' if redis_healthy else 'disconnected',
            'initialized': True,
            'timestamp': datetime.utcnow().isoformat()
        }), 200
    else:
        return jsonify({
            'status': 'initializing',
            'service': 'auth',
            'database': 'connected' if db_healthy else 'disconnected',
            'redis': 'connected' if redis_healthy else 'disconnected',
            'initialized': False,
            'timestamp': datetime.utcnow().isoformat()
        }), 200

@app.route('/')
def index():
    return jsonify({
        'message': 'Auth Service - Company Auth System API',
        'service': 'authentication',
        'version': '2.0.0'
    })

def init_db():
    global app_initialized
    
    max_retries = 30
    retry_delay = 2
    
    for attempt in range(max_retries):
        try:
            with app.app_context():
                inspector = db.inspect(db.engine)
                if not inspector.has_table('users'):
                    print(f"Creating database tables... (attempt {attempt + 1})")
                    db.create_all()
                    
                    if User.query.count() == 0:
                        admin_user = User(
                            name='System Administrator',
                            email='admin@company.com',
                            department='it',
                            employee_id='ADM001',
                            role='admin',
                            status='active'
                        )
                        admin_user.set_password('admin123!')
                        db.session.add(admin_user)
                        
                        guest_user = User(
                            name='Guest User',
                            email='guest@company.com',
                            department='it',
                            employee_id='G001',
                            role='user',
                            status='active'
                        )
                        guest_user.set_password('guest123!')
                        db.session.add(guest_user)
                        
                        db.session.commit()
                        print("Default admin user created: admin@company.com / admin123!")
                        print("Default guest user created: guest@company.com / guest123!")
                    else:
                        print("Database tables created successfully")
                else:
                    print("Auth database tables already exist")
                
                app_initialized = True
                print("Auth database initialized successfully")
                return
                
        except OperationalError as e:
            if attempt < max_retries - 1:
                print(f"Database not ready, retrying in {retry_delay}s... ({attempt + 1}/{max_retries})")
                time.sleep(retry_delay)
            else:
                print("Failed to connect to database after multiple attempts")
                raise e

if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)