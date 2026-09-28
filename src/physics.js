export function integrate (tank, input, dt) {
    const speed = 80

    tank.vx = 0
    tank.vy = 0

    if(input("KeyW")) {
        tank.vy = -speed
    } 
    if(input("KeyS")) {
        tank.vy = speed
    } 
    if(input("KeyD")) {
        tank.vx = speed
    } 
    if(input("KeyA")) {
        tank.vx = -speed
    } 

    if (tank.vx !== 0 || tank.vy !== 0) {
        tank.angle = Math.atan2(tank.vy, tank.vx) + Math.PI / 2;
    }
    
    tank.x += tank.vx * dt;
    tank.y += tank.vy * dt;

    if(tank.x > window.innerWidth){
        tank.x = 0
    }
    if(tank.x < 0){
        tank.x = window.innerWidth
    }
    if(tank.y > window.innerHeight){
        tank.y = 0
    }
    if(tank.y < 0){
        tank.y = window.innerHeight
    }
}