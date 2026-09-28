export function render(ctx, tank, previousTank, width, height, alpha) {
    const renderX = previousTank.x + (tank.x - previousTank.x) * alpha
    const renderY = previousTank.y + (tank.y - previousTank.y) * alpha
    const renderAngle = previousTank.angle + (tank.angle - previousTank.angle) * alpha

    const renderTank = {
        x: renderX,
        y: renderY,
        angle: renderAngle
    }

    ctx.clearRect(0, 0, width, height)

    ctx.save()

    ctx.translate(renderTank.x, renderTank.y)
    ctx.rotate(renderTank.angle)

    drawTank(ctx)
    ctx.restore()
}

function drawTank(ctx) {
    ctx.lineWidth = 2
    ctx.strokeRect(-16, -23, 32, 46)

    ctx.fillStyle = '#0F2070'
    ctx.fillRect(-15, -22, 30, 44)
    
    ctx.strokeRect(-8, -12, 16, 23)

    ctx.fillStyle = 'black'
    ctx.fillRect(-20, -19, 5, 40)
    ctx.fillRect(15, -19, 5, 40)
    ctx.fillRect(-2, -38, 5, 40)
}
