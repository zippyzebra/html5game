
function getRGBA( r, g, b, a )
{
	return "rgba( " + r + "," + g + "," + b + "," + a + " )";
}
	
function getRGB( r, g, b )
{
	return "rgb( " + r + "," + g + "," + b + " )";
}

function Point( x, y )
{
	if( typeof( x ) == 'undefined' || typeof( y ) == 'undefined' )
	{
		this.x = 0;
		this.y = 0;
	}
	else
	{
		this.x = x;
		this.y = y;
	}
}

Point.prototype.distanceTo = function( p ) 
{
	var dx = p.x - this.x;
	var dy = p.y - this.y;
	return Math.sqrt( dx*dx + dy*dy );
};

BaseObj.prototype = new Point(0, 0);

function BaseObj()
{
	Point.call( this, 0, 0 );
	this.velocity = new Point( 0, 0 );
	this.size = 0;
	this.speed = 0;
	this.angle = 0;
}

Sun.prototype = new BaseObj();

function Sun()
{
	BaseObj.call( this );
	this.energy = 1;
	this.energyRadius = 0;
}

Defender.prototype = new BaseObj();

function Defender()
{
	BaseObj.call( this );
}

Sun.prototype.updateSize = function( maxSize)
{
	var targetSize = this.energy * maxSize;
	this.energyRadius += ( targetSize - this.energyRadius ) * 0.2;
}

var clockwise = 1;

function ChangeClockwise()
{
    clockwise = 0 - clockwise;
}

BaseObj.prototype.updateAngle = function( rotationChange)
{
    this.angle += rotationChange * clockwise;
	this.angle = Game.normalizeAngle( this.angle );
}

BaseObj.prototype.updateOrbitPosition = function( parent, surfaceDistance)
{
	var orbitDistance = parent.energyRadius + surfaceDistance;
	this.x = parent.x +  Math.cos(this.angle) * orbitDistance;
	this.y = parent.y +  Math.sin(this.angle) * orbitDistance;
}

Sun.prototype.draw = function( context, allAlpha ) 
{	
	context.beginPath();
	context.fillStyle = getRGBA( 235, 155, 25, allAlpha );
	context.strokeStyle = getRGBA( 230, 230, 25, allAlpha );
	context.lineWidth = 1.5;

	var counter;
	for( counter = 0; counter < 64; ++counter )
	{
		var angle = ( Math.PI * 2 ) / 64 * counter;
		
		var x = this.x + Math.cos( angle ) * ( this.energyRadius );
		var y = this.y + Math.sin( angle ) * ( this.energyRadius );

		if( counter == 0 ) 
			context.moveTo( x, y );
		else
			context.lineTo( x, y );
	}

	context.closePath();
	context.fill();
	context.stroke();
};

Sun.prototype.hitCore = function( position )
{
	var angle = Math.atan2( position.y - this.y, position.x - this.x );
	if( angle < 0 )
		angle += Math.PI * 2;
	var RawIndex = 64 / ( Math.PI * 2 / angle );
	var Index0 = Math.floor( RawIndex + 0.5 );
	var Index1 = Index0 + 1;
	if( Index1 >= 64 )
		Index1 -= 64;
	var Adjustment1 = RawIndex % 1;
	var Adjustment0 = 1.0 - Adjustment1;	
	var Index = Index0 - 1;
	if( Index < 0 )
		Index += 64;
	var Index2 = Index1 + 1;
	if( Index2 >= 64 )
		Index2 -= 64;
}

Enemy.prototype = new BaseObj();

function Enemy()
{
	BaseObj.call( this );
	this.size = ( 7 + ( Math.random() * 4 ) ) / 2;
}

Bullet.prototype = new BaseObj();

function Bullet() 
{
	BaseObj.call( this );
	this.destination = new Point( 0, 0 );
	this.size = 2.5;

	this.lastDistance = 999999999.9;
}

EnemyProjectile.prototype = new BaseObj();

function EnemyProjectile() 
{
	BaseObj.call( this );
	this.angle = 0;
	this.size = 2.5;
	this.speed = 1.5;
	this.type = 'projectile';

	this.lastDistance = 999999999.9;
}

Explosion.prototype = new BaseObj();

function Explosion()
{
	BaseObj.call( this );
	this.life = 0;
	this.alpha = 0;
}

var Game = new function () {
    //在移动设备上可能有问题，取决于移动设备上的浏览器实现
    var isMobile = !!navigator.userAgent.toLowerCase().match(/ipod|ipad|iphone|android/gi);

    var DEFAULT_WIDTH = 1200,
		DEFAULT_HEIGHT = 600,
		BORDER_WIDTH = 6,
		PLANET_SIZE = 38,
		MOON_SIZE = 18,
		EXPLOSION_FADE = 0.5,
		CLICK_QUEUE_LENGTH = 100,
		defender_SIZE = 5.5,
		TARGET_CURVE = 0.025;
    FRAMERATE = 60;

    var world = {
        width: isMobile ? window.innerWidth : DEFAULT_WIDTH,
        height: isMobile ? window.innerHeight : DEFAULT_HEIGHT
    };

    var canvas, context;
    var canvasBackground, contextBackground;
    var status;
    var panels;
    var message;
    var title;
    var startButton;

    var enemies = [];
    var particles = [];
    var bullets = [];
    var explosions = [];
    var clickPoints = [];
    var clickHead = 0;
    var clickTail = 0;
    var gunHeat = 0;
    var overHeat = 0;
    var shieldTime = 0;
    var enemyProjectiles = [];
    var bombCount = 0;
    var planet;
    var moon;
    var defender;

    var level = 0;
    var mouseIsDown = false;
    var activateShield = false;
    var clicks = 0;
    var lastClick = new Date().getTime();

    var changingLevels = false;

    // Game properties and scoring
    var playing = false;
    var score = 0;
    var time = 0;
    var duration = 0;
    var difficulty = 1;
    var lastSpawn = 0;
    var nextEnemyProjectile = 0;
    var allAlpha = 1;
    var fade = 0;

    var timeScale = 1;

    // 根据玩家坚持的时间统计玩家分数
    var fps = 0;
    var timeLastSecond = new Date().getTime();
    var frames = 0;
    var lastTime = 0;

    this.init = function () {
        canvas = document.getElementById('world');
        canvasBackground = document.getElementById('background');
        panels = document.getElementById('panels');
        status = document.getElementById('status');
        message = document.getElementById('message');
        title = document.getElementById('title');
        startButton = document.getElementById('startButton');

        if (canvas && canvas.getContext) {
            context = canvas.getContext('2d');

            contextBackground = canvasBackground.getContext('2d');

            document.addEventListener('mousemove', documentMouseMoveHandler, false);
            document.addEventListener('mousedown', documentMouseDownHandler, false);
            document.addEventListener('mouseup', documentMouseUpHandler, false);
            canvas.addEventListener('touchstart', documentTouchStartHandler, false);
            document.addEventListener('touchmove', documentTouchMoveHandler, false);
            document.addEventListener('touchend', documentTouchEndHandler, false);
            window.addEventListener('resize', windowResizeHandler, false);
            startButton.addEventListener('click', startButtonClickHandler, false);
            document.addEventListener('keydown', documentKeyDownHandler, false);
            document.addEventListener('keyup', documentKeyUpHandler, false);
            canvas.onselectstart = function () { return false; }
            document.onselectstart = function () { return false; }

            window.addEventListener('load', function (e) {
                window.applicationCache.addEventListener('updateready', function (e) {
                    if (window.applicationCache.status == window.applicationCache.UPDATEREADY) {
                        window.applicationCache.swapCache();
                        if (confirm('A new version of this site is available. Load it?')) {
                            var Body = document.getElementById("body");
                            if (Body)
                                Body.innerHTML = "reloading...";
                            window.location.reload();
                        }
                    }
                }, false);

            }, false);

            planet = new Sun(0, 0);
            moon = new Sun(0, 0);
            defender = new Defender(0, 0);

            windowResizeHandler();
            defaultStatus();
            animate();
        }
    };

    //鼠标点击开火
    function documentMouseDownHandler(event) {
        mouseIsDown = true;
        var mouseX = event.clientX - (window.innerWidth - world.width) * 0.5 - BORDER_WIDTH;
        var mouseY = event.clientY - (window.innerHeight - world.height) * 0.5 - BORDER_WIDTH;
        fire(mouseX, mouseY);
    }

    function documentMouseUpHandler(event) {
        mouseIsDown = false;
        return false;
    }

    function documentTouchStartHandler(event) {
        if (event.touches.length == 1) {
            event.preventDefault();

            var mouseX = event.touches[0].pageX - (window.innerWidth - world.width) * 0.5;
            var mouseY = event.touches[0].pageY - (window.innerHeight - world.height) * 0.5;

            mouseIsDown = true;

            fire(mouseX, mouseY);
        }
        else if (event.touches.length == 2) {
            event.preventDefault();
            ChangeClockwise();
        }
    }

    function documentTouchMoveHandler(event) {
        if (event.touches.length == 1) {
            event.preventDefault();

            var mouseX = event.touches[0].pageX - (window.innerWidth - world.width) * 0.5 - 60;
            var mouseY = event.touches[0].pageY - (window.innerHeight - world.height) * 0.5 - 30;
        }
    }

    function documentTouchEndHandler(event) {
        mouseIsDown = false;
    }

    //按下空格键
    function documentKeyDownHandler(event) {
        switch (event.keyCode) {
            case 32:
                ChangeClockwise();
                event.preventDefault();
                break;
        }
    }
    function documentKeyUpHandler(event) {
        switch (event.keyCode) {
            case 32:
                event.preventDefault();
                break;
        }
    }

    //鼠标位移
    function documentMouseMoveHandler(event) {
        var mouseX = event.clientX - (window.innerWidth - world.width) * 0.5 - BORDER_WIDTH;
        var mouseY = event.clientY - (window.innerHeight - world.height) * 0.5 - BORDER_WIDTH;
    }

    function getParam(name) {
        name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
        var regexS = "[\\?&]" + name + "=([^&#]*)";
        var regex = new RegExp(regexS);
        var results = regex.exec(window.location.href);
        if (results == null)
            return "";
        else
            return results[1];
    }

    //从中心渐进变暗
    function renderBackground() {
        var gradient = contextBackground.createRadialGradient(world.width * 0.5, world.height * 0.5, 0, world.width * 0.5, world.height * 0.5, 300);
        gradient.addColorStop(0, 'rgba(2, 20, 40, 1)');
        gradient.addColorStop(1, 'rgba(0, 0, 0, 1)');

        contextBackground.fillStyle = gradient;
        contextBackground.fillRect(0, 0, world.width, world.height);
    }


    function startButtonClickHandler(event) {
        if (playing == false) {
            playing = true;

            enemies = [];
            bullets = [];
            enemyProjectiles = [];
            explosions = [];
            nextEnemyProjectile = new Date().getTime() + 2000 + (Math.random() * 8000);
            score = 0;
            difficulty = 1;
            var templevel = getParam("level");
            if (templevel >= 1)
                level = templevel - 1;
            else
                level = 0;
            changingLevels = false;
            allAlpha = 0;
            fade = 0.005;
            bombCount = 0;
            planet.energy = 1;
            moon.energy = 1;
            panels.style.display = 'none';
            time = new Date().getTime();
            planet.create(2);
            moon.create(3);
        }
        return false;
    }

    function defaultStatus() {
        status.innerHTML = "<span><b>Game Demo Version 1.0</b></span> <i> By Zheng</a></i>";
    }

    //游戏结束显示分数
    function gameOver() {
        playing = false;

        duration = new Date().getTime() - time;
        score = Math.max(Math.round(score), 0);
        title.innerHTML = 'Game Over! Score: ' + score;
        scoreText = 'Score: <span>' + Math.round(score) + '</span>';
        scoreText += ' Time: <span>' + Math.round(((new Date().getTime() - time) / 1000) * 100) / 100 + 's</span>';
        status.innerHTML = scoreText;

        defaultStatus();
    }

    //限制一段时间子弹数目
    function fire(x, y) {
        if (!playing)
            return;

        clickPoints[clickHead] = new Point(x, y);

        if (overHeat <= 0) {
            gunHeat += .30 * timeScale;
            if (gunHeat >= 1.0) {
                overHeat = 1.0;
                gunHeat = 0;
            }

            ++clickHead;
            if (clickHead >= CLICK_QUEUE_LENGTH)
                clickHead = 0;
            if (clickHead == clickTail) {
                ++clickTail;
                if (clickTail >= CLICK_QUEUE_LENGTH)
                    clickTail = 0;
            }
        }
    }

    function windowResizeHandler() {
        world.width = isMobile ? window.innerWidth : DEFAULT_WIDTH;
        world.height = isMobile ? window.innerHeight : DEFAULT_HEIGHT;

        planet.x = world.width * 0.5;
        planet.y = world.height * 0.5;

        canvas.width = world.width;
        canvas.height = world.height;
        canvasBackground.width = world.width;
        canvasBackground.height = world.height;


        var cvx = Math.floor((window.innerWidth - world.width) * 0.5);
        var cvy = Math.floor((window.innerHeight - world.height) * 0.5);
        cvx -= BORDER_WIDTH;
        cvy -= BORDER_WIDTH;

        canvas.style.position = 'absolute';
        canvas.style.left = cvx + 'px';
        canvas.style.top = cvy + 'px';
        canvasBackground.style.position = 'absolute';
        canvasBackground.style.left = cvx + BORDER_WIDTH + 'px';
        canvasBackground.style.top = cvy + BORDER_WIDTH + 'px';

        var PanelOffsetX = -panels.offsetWidth / 2;
        var PanelOffsetY = -panels.offsetHeight / 2;

        if (isMobile) {
            canvas.style.border = 'none';
            status.style.left = '0px';
            status.style.top = '0px';
            status.style.width = world.width - 6 + "px";
            panels.style.left = Math.floor(cvx + (world.width / 2) + PanelOffsetX) + 'px';
            panels.style.top = Math.floor(cvy + (world.height / 2) + PanelOffsetY) + 'px';
        }
        else {
            status.style.left = cvx + BORDER_WIDTH + 'px';
            status.style.top = cvy + BORDER_WIDTH + 'px';
            status.style.width = DEFAULT_WIDTH - 6 + "px";
            panels.style.left = Math.floor(cvx + BORDER_WIDTH + (world.width / 2) + PanelOffsetX) + 'px';
            panels.style.top = Math.floor(cvy + BORDER_WIDTH + (world.height / 2) + PanelOffsetY) + 'px';
        }

        renderBackground();
    }

    //生成敌人
    function enemyGenerated(position, direction, spread, count, size, explosion_here, speedAdjust) {
        var q = count + (Math.random() * (count / 8));

        while (--q >= 0) {
            var p = new Point();
            p.x = position.x + (Math.sin(q) * spread);
            p.y = position.y + (Math.cos(q) * spread);
            var speed;
            if (explosion_here)
                speed = 0.4 + Math.random() * 0.4;
            else
                speed = 0.2 + Math.random() * 0.6;
            speed *= speedAdjust;
            var angle = Math.random() * Math.PI * 2;
            p.velocity = { x: direction.x + Math.cos(angle) * speed, y: direction.y + Math.sin(angle) * speed };
            p.alpha = size;

            particles.push(p);
        }
        if (explosion_here) {
            var e = new Explosion();
            e.life = size;
            e.alpha = size;
            e.x = position.x;
            e.y = position.y;
            e.speed = 0.7 * speedAdjust;
            explosions.push(e);
        }
    }

    function explode(position) {
        enemyGenerated(position, { x: 0, y: 0 }, 1, 25, 13, 1, .7);
    }

    function detectCollisions(object, checkCores, checkdefender, checkExplosions) {
        if (checkCores) {
            if (object.distanceTo(planet) < planet.energyRadius + object.size) {
                explode(object);
                planet.energy -= 0.06;
                planet.energy = Math.max(Math.min(planet.energy, 1), 0.000001);
                planet.hitCore(object);
                return true;
            }
            else if (object.distanceTo(moon) < moon.energyRadius + object.size) {
                explode(object)
                moon.energy -= 0.04;
                moon.hitCore(object);
                moon.energy = Math.max(Math.min(moon.energy, 1), 0.000001);
                return true;
            }
        }

        if (checkdefender) {
            if (object.distanceTo(defender) < defender_SIZE) {
                explode(object);
                overHeat = 2.5;
                return true;
            }
        }

        if (checkExplosions) {
            for (counter = 0; counter < explosions.length; counter++) {
                e = explosions[counter];

                if (e.distanceTo(object) <= e.size + 2) {
                    explode(object);
                    return true;
                }
            }
        }
    }

    function ShootAt(eventposition) {
        var bullet = new Bullet();

        bullet.x = defender.x;
        bullet.y = defender.y;
        bullet.destination.x = eventposition.x;
        bullet.destination.y = eventposition.y;

        bullet.speed = 1.5;

        var angle = Math.atan2(eventposition.y - defender.y, eventposition.x - defender.x);
        bullet.velocity.x = Math.cos(angle) * bullet.speed;
        bullet.velocity.y = Math.sin(angle) * bullet.speed;

        score -= 3;

        bullets.push(bullet);
    }

    function createEnemies() {
        var enemy = new EnemyProjectile();
        var side = Math.round(Math.random() * 3);

        switch (side) {
            case 0:
                enemy.x = 3;
                enemy.y = world.height * Math.random();
                break;
            case 1:
                enemy.x = world.width * Math.random();
                enemy.y = 3;
                break;
            case 2:
                enemy.x = world.width - 3;
                enemy.y = world.height * Math.random();
                break;
            case 3:
                enemy.x = world.width * Math.random();
                enemy.y = world.height - 3;
                break;
        }

        enemy.speed = 1.2;

        enemy.angle = Math.atan2(defender.y - enemy.y, defender.x - enemy.x);
        if (enemy.angle < 0)
            enemy.angle += Math.PI * 2;
        else if (enemy.angle >= Math.PI * 2)
            enemy.angle -= Math.PI * 2;

        enemy.alpha = 0;

        enemyProjectiles.push(enemy);
    }

    function createEnemy() {
        var enemy = new Enemy();
        var side = Math.round(Math.random() * 3);

        switch (side) {
            case 0:
                enemy.x = 3;
                enemy.y = world.height * Math.random();
                break;
            case 1:
                enemy.x = world.width * Math.random();
                enemy.y = 3;
                break;
            case 2:
                enemy.x = world.width - 3;
                enemy.y = world.height * Math.random();
                break;
            case 3:
                enemy.x = world.width * Math.random();
                enemy.y = world.height - 3;
                break;
        }

        enemy.speed = 0.5 + (Math.random() * 0.2);
        enemy.speed += (difficulty - 1) * 0.1;

        var distance = enemy.distanceTo(planet);
        distance = Math.min(distance, 350);
        distance /= 350;

        enemy.speed *= distance;

        var angle = Math.atan2(planet.y - enemy.y, planet.x - enemy.x);
        enemy.velocity.x = Math.cos(angle) * enemy.speed;
        enemy.velocity.y = Math.sin(angle) * enemy.speed;

        enemy.alpha = 0;

        lastSpawn = new Date().getTime();

        ++bombCount;

        enemies.push(enemy);
    }

    function msleep(milliseconds) {
        var start = new Date().getTime();
        for (var i = 0; i < 1e7; i++) {
            if ((new Date().getTime() - start) > milliseconds) {
                break;
            }
        }
    }

    this.normalizeAngle = function (angle) {
        while (angle < 0)
            angle += Math.PI * 2;
        while (angle > Math.PI * 2)
            angle -= Math.PI * 2;

        return angle;
    }

    function withinAngle(leftAngle, rightAngle, testAngle) {
        if (rightAngle == leftAngle)
            return testAngle == leftAngle ? true : false;

        if (rightAngle > leftAngle)
            return (testAngle >= leftAngle && testAngle <= rightAngle) ? true : false;
        else
            return (testAngle >= leftAngle || testAngle <= rightAngle) ? true : false;

        return false;
    }

    function pickBestDirection(p) {
        if (!playing)
            return p.angle;

        var angle = Game.normalizeAngle(Math.atan2(defender.y - p.y, defender.x - p.x));

        var difference = angle - p.angle;
        if (difference < -Math.PI)
            difference += Math.PI * 2;
        if (difference > Math.PI)
            difference -= Math.PI * 2;
        difference = Math.min(Math.max(difference, -TARGET_CURVE * timeScale), TARGET_CURVE * timeScale);

        var newAngle = Game.normalizeAngle(p.angle + difference);
        var distanceTodefender = p.distanceTo(defender);
        var opposite = planet.energyRadius + 8;
        var hypotenuse = p.distanceTo(planet);
        var distanceToTangent = Math.sqrt(opposite * opposite + hypotenuse * hypotenuse);

        if (hypotenuse < opposite)
            return p.angle;

        if (hypotenuse > 150 || distanceTodefender < distanceToTangent)
            return newAngle;

        var coreAngle = Game.normalizeAngle(Math.atan2(planet.y - p.y, planet.x - p.x));

        if (hypotenuse < opposite) {
            var limitLeftAngle = Game.normalizeAngle(coreAngle - (Math.PI / 2));
            var limitRightAngle = Game.normalizeAngle(coreAngle + (Math.PI / 2));
            if (withinAngle(limitLeftAngle, coreAngle, newAngle))
                return limitLeftAngle;
            else
                return limitRightAngle;
        }

        var offsetAngle = Math.asin(opposite / hypotenuse);
        if (hypotenuse < opposite)
            offsetAngle = Math.asin(1);
        var leftAngle = Game.normalizeAngle(coreAngle - offsetAngle);
        var rightAngle = Game.normalizeAngle(coreAngle + offsetAngle);

        if (!withinAngle(leftAngle, rightAngle, newAngle))
            return newAngle;

        var pushAngle = 0;
        var leftDistance = leftAngle - newAngle;
        if (leftDistance > 0)
            leftDistance -= Math.PI * 2;
        var rightDistance = rightAngle - newAngle;
        if (rightDistance < 0)
            rightDistance += Math.PI * 2;

        if (Math.abs(leftDistance) < Math.abs(rightDistance)) {
            difference = leftAngle - p.angle;
            if (difference > 0)
                difference = 0;
        }
        else {
            difference = rightAngle - p.angle;
            if (difference < 0)
                difference = 0;
        }
        if (difference < -Math.PI)
            difference += Math.PI * 2;
        if (difference > Math.PI)
            difference -= Math.PI * 2;
        difference = Math.min(Math.max(difference, -TARGET_CURVE * timeScale), TARGET_CURVE * timeScale);

        newAngle = p.angle + difference;

        return Game.normalizeAngle(newAngle);
    }

    function animate() {

        var frameTime = new Date().getTime();
        var elapsedTime = frameTime - lastTime;
        lastTime = frameTime;
        frames++;
        timeScale = elapsedTime / (Math.floor(1000 / 60));

        if (elapsedTime > 500)
            timeScale = 1;

        allAlpha = Math.min(1, allAlpha + fade * timeScale);
        if (allAlpha <= 0) {
            fade = 0.005;
            allAlpha = 0;
        }

        if (frameTime > timeLastSecond + 1000) {
            fps = Math.min(Math.round((frames * 1000) / (frameTime - timeLastSecond)), FRAMERATE);
            timeLastSecond = frameTime;
            frames = 0;
        }

        context.clearRect(0, 0, canvas.width, canvas.height);

        var ShowUI = !playing && particles.length > 0;
        if (playing) {
            difficulty += 0.0003;
            score += ((0.17 * difficulty) + (level * 0.17)) * timeScale;
            planet.updateSize(PLANET_SIZE);

            moon.updateSize(MOON_SIZE);
            moon.updateAngle(-0.01 * timeScale * 0.4)
            moon.updateOrbitPosition(planet, 55);

            defender.updateAngle(0.005 + (0.005 * timeScale / (level == 2 ? moon.energy : planet.energy)));
            if (level == 2)
                defender.updateOrbitPosition(moon, 15);
            else
                defender.updateOrbitPosition(planet, 15);
        }

        var enemyCount = 0;
        var enemyProjectileCount = 0;
        var explosioncount = 0;

        for (i = 0; i < enemies.length; i++) {
            p = enemies[i];
            p.x += p.velocity.x * timeScale;
            p.y += p.velocity.y * timeScale;

            p.alpha = Math.min(p.alpha + 0.008 * timeScale, 1);

            context.fillStyle = getRGBA(85, 168, 5, Math.min(allAlpha, p.alpha));
            context.strokeStyle = getRGBA(125, 245, 3, Math.min(allAlpha, p.alpha));

            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2, true);
            context.lineWidth = 1.5;
            context.fill();
            context.stroke();

            if (playing) {
                if (detectCollisions(p, true, false, true))
                    p.dead = true;
            }

            if (p.x < -p.size || p.x > world.width + p.size || p.y < -p.size || p.y > world.height + p.size) {
                p.dead = true;
            }

            if (p.dead) {
                enemies.splice(i, 1);
                i--;
            }
            else
                enemyCount++;
        }

        for (i = 0; i < bullets.length; i++) {
            p = bullets[i];
            p.x += p.velocity.x * timeScale;
            p.y += p.velocity.y * timeScale;

            context.fillStyle = getRGBA(255, 168, 0, allAlpha);
            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2, true);
            context.fill();

            var distance = p.distanceTo(p.destination);
            if (distance < 1.5 || distance > p.lastDistance) {
                explode(p.destination);
                p.dead = true;
            }
            else if (detectCollisions(p, true, false, false))
                p.dead = true;

            p.lastDistance = distance;

            if (p.dead) {
                bullets.splice(i, 1);
                i--;
            }
        }

        for (i = 0; i < enemyProjectiles.length; i++) {
            p = enemyProjectiles[i];

            p.angle = pickBestDirection(p);

            var velocity = { x: 0, y: 0 };
            velocity.x = Math.cos(p.angle) * p.speed;
            velocity.y = Math.sin(p.angle) * p.speed;

            p.x += velocity.x * timeScale;
            p.y += velocity.y * timeScale;

            context.fillStyle = getRGBA(176, 174, 0, allAlpha);
            context.beginPath();
            context.arc(p.x, p.y, p.size, 0, Math.PI * 2, true);
            context.fill();

            if (detectCollisions(p, true, true, true))
                p.dead = true;

            p.lastDistance = distance;

            if (p.dead) {
                nextEnemyProjectile = new Date().getTime() + 2000 + (Math.random() * 8000);
                enemyProjectiles.splice(i, 1);
                i--;
            }
            else
                ++enemyProjectileCount;
        }

        for (i = 0; i < explosions.length; i++) {
            e = explosions[i];
            if (e.life < .1) {
                e.life -= EXPLOSION_FADE / 4;
                e.size += e.speed / 4;
            }
            else {
                e.life -= EXPLOSION_FADE;
                e.size += e.speed;
            }

            e.alpha = Math.max(e.alpha - EXPLOSION_FADE, 0);

            context.beginPath();
            var useAlpha = Math.min(allAlpha, Math.min(e.alpha / 50, 0.05));
            context.fillStyle = getRGBA(240, 235, 80, useAlpha);
            context.arc(e.x, e.y, e.size, 0, Math.PI * 2, true);
            context.fill();

            if (e.life <= 0) {
                explosions.splice(i, 1);
                i--;
            }
        }

        for (i = 0; i < particles.length; i++) {
            p = particles[i];
            p.x += p.velocity.x * timeScale;
            p.y += p.velocity.y * timeScale;

            p.alpha = Math.max(p.alpha - EXPLOSION_FADE, 0);

            context.fillStyle = getRGBA(245, 220, 70, Math.min((p.alpha / 8), allAlpha));
            context.fillRect(p.x, p.y, 1, 1);

            if (p.alpha <= 0)
                particles.splice(i, 1);
            else {
                ShowUI = false;
            }
        }

        if (playing) {
            if (level == 2)
                moon.draw(context, allAlpha);

            planet.draw(context, allAlpha);

            context.beginPath();
            if (overHeat > 0) {
                context.fillStyle = getRGBA(225, 130, 145, allAlpha);
            }
            else {
                context.fillStyle = getRGBA(245, 10, 45, allAlpha);
            }

            context.strokeStyle = getRGBA(238, 238, 238, allAlpha);
            context.lineWidth = 1.5;
            context.arc(defender.x, defender.y, defender_SIZE, 0, Math.PI * 2, true);
            context.fill();
            context.stroke();

            if (overHeat > 0)
                overHeat -= 0.01 * timeScale;
            if (gunHeat > 0)
                gunHeat -= 0.01 * timeScale;

            if (clickHead != clickTail) {
                var SinceLastLick = frameTime - lastClick;
                if (SinceLastLick > 200) {
                    ShootAt({ x: clickPoints[clickTail].x, y: clickPoints[clickTail].y });
                    lastClick = frameTime;
                    ++clickTail;
                    if (clickTail >= CLICK_QUEUE_LENGTH)
                        clickTail = 0;
                }
            }

            scoreText = '<span><b>Game Demo Version 1.0</b></span>&nbsp;&nbsp;&nbsp;Score: <span>' + Math.max(Math.round(score), 0) + '</span>';

            status.innerHTML = scoreText;

            if (planet.energy <= 0.0999 || (level == 2 && moon.energy <= 0.0999)) // reasonable size as a minimum. Zero is too small.
            {
                enemyGenerated(planet, { x: 0, y: 0 }, 10, 40, 15, 0, 1);
                enemyGenerated(planet, { x: 0, y: 0 }, 2, 6, 25, 0, 1);

                if (level == 2)
                    enemyGenerated(moon, { x: 0, y: 0 }, 5, 30, 10, 0, 1);

                enemyGenerated(defender, { x: 0, y: 0 }, 3, 20, 10, 0, 1);
                enemyGenerated(defender, { x: 0, y: 0 }, 3, 20, 10, 0, 1);

                gameOver();
            }
        }

        if (changingLevels) {
            if (enemyCount == 0 && enemyProjectileCount == 0 && particles.length == 0 && explosions == 0) {
                if (level == 0) {
                    changingLevels = false;
                    ++level;
                    bombCount = 0;
                    difficulty = 1;
                }
                else {
                    if (allAlpha >= 1) {
                        fade = -0.005;
                        allAlpha = 1 - fade;
                    }
                    else if (allAlpha <= 0) {
                        changingLevels = false;
                        ++level;
                        bombCount = 0;
                        difficulty = 1;

                        planet.energy = 1;
                        moon.energy = 1;
                        planet.create(2);
                        moon.create(3);
                    }
                }
            }
        }
        else {
            if (enemyCount < 1 * difficulty && new Date().getTime() - lastSpawn > 200 && allAlpha >= 1)
                createEnemy();

            if (playing) {
                if (level == 1 && enemyProjectileCount < 1 && new Date().getTime() > nextEnemyProjectile && allAlpha >= 1)
                    createEnemies();
                if (level == 0 && bombCount > 60)
                    changingLevels = true;
                if (level == 1 && bombCount > 20)
                    changingLevels = true;
            }
        }

        if (ShowUI)
            panels.style.display = 'block';

        requestAnimFrame(animate);
    }


};

window.requestAnimFrame = (function(){
  return  window.requestAnimationFrame       || 
          window.webkitRequestAnimationFrame || 
          window.mozRequestAnimationFrame    || 
          window.oRequestAnimationFrame      || 
          window.msRequestAnimationFrame     || 
          function(/* function */ callback, /* DOMElement */ element){
            window.setTimeout(callback, 1000 / 60);
          };
})();

Game.init();