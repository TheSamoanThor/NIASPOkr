#NISAPOkr
<br>
ВНИМАНИЕ: в данной версии большинство скриптов для запуска адаптировано под Windows, тестировалось на версии Windows 10, из-за чего большинство из этих скриптов не запустится на других ОС.
<br>
Для запуска текущей версии программы пропишите в желаемой папке на Вашем компьютере через терминал Git Bash или любой другой:
<pre><code>git clone https://github.com/TheSamoanThor/NIASPOkr.git</code></pre>
Далее дождитесь копирования файлов. После этого можно запустить приложение двумя разными путями - через docker compose и через docker swarm. Для первого запустите файл START_PROGRAM.bat, для второго - сначала DEPLOY_SWARM.bat, затем MANAGE_SWATM.bat. Запуск режима swarm возможен и через START_PROGRAM_SWARM.bat, но могут возникнуть проблемы с обработкой комманд после построения всех образов.
<br>
ATTENTION: In this version, most of the startup scripts are adapted for Windows and were tested on Windows 10, so most of these scripts will not run on other operating systems.
<br>
To launch the current version of the program, enter the following command in the desired folder on your computer using the Git Bash or any other terminal:
<pre><code>git clone https://github.com/TheSamoanThor/NIASPOkr.git</code></pre>
Then wait for the files to copy. After this, you can launch the application in two different ways: via Docker Compose and via Docker Swarm. For the former, run START_PROGRAM.bat; for the latter, first DEPLOY_SWARM.bat, then MANAGE_SWATM.bat. Launching swarm mode is also possible using START_PROGRAM_SWARM.bat, but there may be issues processing commands after all images have been built.
<br>