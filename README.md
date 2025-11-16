# NIASPOkr - Система управления пользователями

<hr>

<h2>Предварительные требования</h2>

<p>Перед началом работы убедитесь, что на вашей системе установлены:</p>

<ul>
<li>Docker</li>
<li>Docker Compose</li>
</ul>

<h3>Проверка установки:</h3>

<pre><code># Проверить установку Docker
docker --version

# Проверить установку Docker Compose  
docker compose version</code></pre>

<h3>Особенности для Windows:</h3>

<ul>
<li>Docker Desktop с включенной опцией WSL 2</li>
<li>WSL 2 (Windows Subsystem for Linux) для оптимальной работы</li>
<li>Убедитесь, что в Docker Desktop включены</li>
</ul>

<h3>Особенности для Linux:</h3>

<ul>
<li>Демон Docker должен быть запущен</li>
<li>Пользователь должен быть в группе docker</li>
</ul>

<h3>Особенности для macOS:</h3>

<ul>
<li>Docker Desktop для Mac</li>
</ul>

<hr>

<h2>Быстрый старт</h2>

<h3>Клонирование репозитория и переход в него:</h3>

<pre><code>git clone https://github.com/TheSamoanThor/NIASPOkr.git
cd NIASPOkr</code></pre>

<hr>

<h2>Запуск приложения</h2>

<h3>Способ 1: Docker Compose (рекомендуется для разработки или простого тестирования)</h3>

<p>Windows:</p>

<pre><code>START_PROGRAM.bat</code></pre>

<p>Linux/macOS:</p>

<pre><code>docker-compose down
docker compose up --build</code></pre>

<h3>Способ 2: Docker Swarm (для продакшена)</h3>

<p>Windows:</p>

<pre><code>DEPLOY_SWARM.bat
MANAGE_SWARM.bat</code></pre>

<p>Linux/macOS:</p>

<pre><code># Инициализация и деплой
docker swarm init
docker stack deploy -c docker-compose.swarm.yml auth-system

# Управление стеком
docker service ls --filter name=auth-system_</code></pre>

<h3>Альтернативный запуск Swarm (Windows):</h3>

<pre><code>START_PROGRAM_SWARM.bat</code></pre>

<hr>

<h2>Доступ к приложению</h2>

<p>После успешного запуска приложение будет доступно по адресу:</p>

<pre><code>http://localhost:80</code></pre>

<h3>Тестовые учетные записи:</h3>

<ul>
<li>Администратор: admin@company.com / admin123!</li>
<li>Гостевой пользователь: guest@company.com / guest123!</li>
</ul>

<hr>

<h2>Управление приложением</h2>

<h3>Просмотр логов:</h3>

<pre><code># Windows
MANAGE_SWARM.bat

# Затем в интерактивном режиме команда 'logs'

# Linux/macOS
docker service logs auth-system_frontend --tail 20</code></pre>

<h3>Остановка приложения:</h3>

<pre><code># Docker Compose
docker-compose down

# Docker Swarm
docker stack rm auth-system</code></pre>

<h3>Полная очистка (Swarm):</h3>

<pre><code># Windows - через MANAGE_SWARM.bat команда 'cleanup'
# Linux/macOS
docker stack rm auth-system
docker swarm leave --force
docker volume prune -f</code></pre>

<hr>

<h2>Примечания</h2>

<h3>ВНИМАНИЕ:</h3>

<p>В данной версии большинство скриптов для запуска адаптировано под Windows и тестировалось на Windows 10. Скрипты .bat не запустятся на других ОС - используйте соответствующие команды для вашей системы.</p>

<hr>





















<h2>Prerequisites</h2>

<p>Before you begin, make sure you have the following installed on your system:</p>

<ul>
<li>Docker</li>
<li>Docker Compose</li>
</ul>

<h3>Installation Check:</h3>

<pre><code># Check Docker installation
docker --version

# Check Docker Compose installation
docker compose version</code></pre>

<h3>Windows considerations:</h3>

<ul>
<li>Docker Desktop with WSL 2 enabled</li>
<li>WSL 2 (Windows Subsystem for Linux) for optimal performance</li>
<li>Make sure Docker Desktop is enabled</li>
</ul>

<h3>Linux considerations:</h3>

<ul>
<li>The Docker daemon must be running</li>
<li>The user must be in the group Docker</li>
</ul>

<h3>MacroOS Features:</h3>

<ul>
<li>Docker Desktop for Mac</li>
</ul>

<hr>

<h2>Quick Start</h2>

<h3>Clone a Repository and Switch to It:</h3>

<pre><code>git clone https://github.com/TheSamoanThor/NIASPOkr.git
cd NIASPOkr</code></pre>

<hr>

<h2>Running the Application</h2>

<h3>Method 1: Docker Compose (recommended for development or simple testing)</h3>

<p>Windows:</p>

<pre><code>START_PROGRAM.bat</code></pre>

<p>Linux/macOS:</p>

<pre><code>docker-compose down
docker compose up --build</code></pre>

<h3>Method 2: Docker Swarm (for production)</h3>

<p>Windows:</p>

<pre><code>DEPLOY_SWARM.bat
MANAGE_SWARM.bat</code></pre>

<p>Linux/macOS:</p>

<pre><code># Initialization and Deployment
docker swarm init
docker stack deploy -c docker-compose.swarm.yml auth-system

# Stack Management
docker service ls --filter name=auth-system_</code></pre>

<h3>Alternative Swarm Start (Windows):</h3>

<pre><code>START_PROGRAM_SWARM.bat</code></pre>

<hr>

<h2>Accessing the Application</h2>

<p>After a successful launch, the application will be accessible via Address:</p>

<pre><code>http://localhost:80</code></pre>

<h3>Test accounts:</h3>

<ul>
<li>Administrator: admin@company.com / admin123!</li>
<li>Guest user: guest@company.com / guest123!</li>
</ul>

<hr>

<h2>Managing the application</h2>

<h3>Viewing logs:</h3>

<pre><code># Windows
MANAGE_SWARM.bat

# Then, in interactive mode, run the 'logs' command

# Linux/macOS
docker service logs auth-system_frontend --tail 20</code></pre>

<h3>Stopping the application:</h3>

<pre><code># Docker Compose
docker-compose down

# Docker Swarm
docker stack rm auth-system</code></pre>

<h3>Full cleanup (Swarm):</h3>

<pre><code># Windows - via MANAGE_SWARM.bat 'cleanup' command
# Linux/macOS
docker stack rm auth-system
docker swarm leave --force
docker volume prune -f</code></pre>

<hr>

<h2>Notes</h2>

<h3>ATTENTION:</h3>

<p>In this version, most startup scripts are adapted for Windows and were tested on Windows 10. The .bat scripts will not run on other operating systems - use the appropriate commands for your system.</p>

<hr>