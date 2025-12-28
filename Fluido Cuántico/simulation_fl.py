import pygame
import numpy as np
import imageio
import sys

# --- CONFIGURACIÓN EQUILIBRADA (VELOZ PERO ESTABLE) ---
WIDTH, HEIGHT = 200, 200  
SCALING = 4               
SAVE_GIF = True
MAX_FRAMES = 180*4          

CONFIG = {
    "difusion_u": 0.16,      
    "difusion_v": 0.08,      
    "feed_rate": 0.055,      
    "kill_rate": 0.062,      
    "dt": 1.15               # Bajamos el dt para que no "explote" la química
}

COLOR_DEEP = np.array([20, 0, 50])      
COLOR_GLOW = np.array([100, 255, 255])  
COLOR_HEART = np.array([255, 150, 0])   

def laplacian(Z):
    return (
        np.roll(Z, 1, axis=0) + np.roll(Z, -1, axis=0) +
        np.roll(Z, 1, axis=1) + np.roll(Z, -1, axis=1) -
        4 * Z
    )

def main():
    global SAVE_GIF 
    
    pygame.init()
    screen = pygame.display.set_mode((WIDTH * SCALING, HEIGHT * SCALING))
    pygame.display.set_caption("Fractal Estable - Reacción Difusión")
    clock = pygame.time.Clock()

    U = np.ones((WIDTH, HEIGHT))
    V = np.zeros((WIDTH, HEIGHT))

    # Semilla original
    seed_size = 3
    for _ in range(5): 
        sx, sy = np.random.randint(WIDTH//4, WIDTH - WIDTH//4), np.random.randint(HEIGHT//4, HEIGHT - HEIGHT//4)
        U[sx-seed_size:sx+seed_size, sy-seed_size:sy+seed_size] = 0.5
        V[sx-seed_size:sx+seed_size, sy-seed_size:sy+seed_size] = 0.25

    frames_list = []
    running = True
    f_count = 0

    print("Corriendo en modo rápido estable... Grabando GIF.")

    while running:
        for event in pygame.event.get():
            if event.type == pygame.QUIT:
                running = False

        # --- FÍSICA OPTIMIZADA ---
        # 8 pasos es el límite seguro para que no desaparezcan
        for _ in range(8): 
            lu = laplacian(U)
            lv = laplacian(V)
            uv2 = U * V**2
            U += (CONFIG["difusion_u"] * lu - uv2 + CONFIG["feed_rate"] * (1 - U)) * CONFIG["dt"]
            V += (CONFIG["difusion_v"] * lv + uv2 - (CONFIG["feed_rate"] + CONFIG["kill_rate"]) * V) * CONFIG["dt"]
            # El clip es vital para que no se rompa la simulación
            np.clip(U, 0, 1, out=U)
            np.clip(V, 0, 1, out=V)

        # --- VISUALIZACIÓN ---
        v_flat = V.reshape((WIDTH, HEIGHT, 1))
        render_data = (1 - v_flat) * COLOR_DEEP + v_flat * COLOR_GLOW * 1.5
        render_data += (v_flat ** 2.5) * COLOR_HEART 

        # Corregimos el swapaxes para que Pygame lo lea bien
        surface = pygame.surfarray.make_surface(render_data.clip(0, 255).astype(np.uint8).swapaxes(0, 1))
        scaled_surface = pygame.transform.smoothscale(surface, (WIDTH * SCALING, HEIGHT * SCALING))
        
        screen.blit(scaled_surface, (0, 0))
        pygame.display.flip()

        if SAVE_GIF and f_count < MAX_FRAMES:
            img = pygame.surfarray.array3d(screen)
            frames_list.append(np.transpose(img, (1, 0, 2))[::2, ::2])
            f_count += 1
            if f_count % 30 == 0:
                print(f"Progreso grabación: {f_count}/{MAX_FRAMES}")
        
        if f_count == MAX_FRAMES and SAVE_GIF:
            print("Captura finalizada. Cierra la ventana.")
            SAVE_GIF = False 

        clock.tick(60)

    if len(frames_list) > 0:
        print("Guardando 'crecimiento_estable.gif'...")
        imageio.mimsave('crecimiento_estable.gif', frames_list, fps=30, loop=0)
        print("¡Listo!")

    pygame.quit()

if __name__ == "__main__":
    main()
