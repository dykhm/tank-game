export function createInput() {
    const keys = {
        KeyA : false,
        KeyD : false,
        KeyS : false,
        KeyW : false
    }

    window.addEventListener('keydown', (event) => {
        if (event.code in keys) {
            keys[event.code] = true
        }
    })
    
    window.addEventListener('keyup', (event) => {
        if (event.code in keys) {
            keys[event.code] = false
        }
    })

    return (key) => keys[key]
}