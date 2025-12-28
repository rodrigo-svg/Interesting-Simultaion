import pygame
import numpy as np
import sys
import imageio  

# --- CONFIGURACIÓN DE LA SIMULACIÓN ---
WIDTH, HEIGHT = 800, 800
GRID_SIZE = 256  
DT = 0.1         
ALPHA = 10.0 + 0.5j  
BETA = 2.1          
GAMMA = 0.1          

# --- CONFIGURACIÓN DEL GIF ---
SAVE_GIF = True
MAX_FRAMES = 300  
frames_list = []

REGIMES = {
    pygame.K_1: (0.5, 1.5, 0.0),   
    pygame.K_2: (0.1, 0.5, 0.05),  
    pygame.K_3: (1.2, -0.2, 0.4),  
}

class QuantumFluid:
    def __init__(self, size):
        self.size = size
        self.psi = (np.random.random((size, size)) - 0.5 + 
                    (np.random.random((size, size)) - 0.5) * 1j) * 0.1
        
        kx = np.fft.fftfreq(size) * 2 * np.pi
        ky = np.fft.fftfreq(size) * 2 * np.pi
        KX, KY = np.meshgrid(kx, ky)
        self.K2 = KX**2 + KY**2
        
        self.alpha = ALPHA
        self.beta = BETA
        self.gamma = GAMMA

    def update(self):
        psi_hat = np.fft.fft2(self.psi)
        kernel = np.exp(-self.alpha * self.K2 * DT)
        psi_hat *= kernel
        self.psi = np.fft.ifft2(psi_hat)

        mag2 = np.abs(self.psi)**2
        reaction = (self.psi - (1 + 1j * self.beta) * mag2 * self.psi + 
                    self.gamma * np.conj(self.psi))
        self.psi += reaction * DT

    def interact(self, pos, radius=5):
        x, y = int(pos[1] * self.size / WIDTH), int(pos[0] * self.size / HEIGHT)
        Y, X = np.ogrid[:self.size, :self.size]
        dist = np.sqrt((X - x)**2 + (Y - y)**2)
        mask = np.exp(-dist**2 / (radius**2))
        self.psi += mask * (np.exp(1j * np.random.uniform(0, 2*np.pi)))

    def get_render_data(self):
        hue = (np.angle(self.psi) + np.pi) / (2 * np.pi)
        val = np.clip(np.abs(self.psi), 0, 1)
        
        h = hue * 6.0
        i = h.astype(int) % 6
        f = h - i
        p = val * (1 - 0.8)
        q = val * (1 - 0.8 * f)
        t = val * (1 - 0.8 * (1 - f))
        
        rgb = np.zeros((self.size, self.size, 3), dtype=np.uint8)
        m0, m1, m2, m3, m4, m5 = i==0, i==1, i==2, i==3, i==4, i==5
        
        rgb[m0] = np.stack([val[m0], t[m0], p[m0]], axis=-1) * 255
        rgb[m1] = np.stack([q[m1], val[m1], p[m1]], axis=-1) * 255
        rgb[m2] = np.stack([p[m2], val[m2], t[m2]], axis=-1) * 255
        rgb[m3] = np.stack([p[m3], q[m3], val[m3]], axis=-1) * 255
        rgb[m4] = np.stack([t[m4], p[m4], val[m4]], axis=-1) * 255
        rgb[m5] = np.stack([val[m5], p[m5], q[m5]], axis=-1) * 255
        
        return rgb

# --- INICIALIZACIÓN PYGAME ---
pygame.init()
screen = pygame.display.set_mode((WIDTH, HEIGHT))
pygame.display.set_caption("Simulador CGL - Grabando GIF...")
clock = pygame.time.Clock()

fluid = QuantumFluid(GRID_SIZE)

# Loop Principal
running = True
frame_count = 0

while running:
    for event in pygame.event.get():
        if event.type == pygame.QUIT:
            running = False
        if event.type == pygame.KEYDOWN:
            if event.key in REGIMES:
                ai, b, g = REGIMES[event.key]
                fluid.alpha = 1.0 + ai * 1j
                fluid.beta = b
                fluid.gamma = g

    if pygame.mouse.get_pressed()[0]:
        fluid.interact(pygame.mouse.get_pos())

    fluid.update()

    rgb_data = fluid.get_render_data()
    surf = pygame.surfarray.make_surface(rgb_data)
    upscaled_surf = pygame.transform.smoothscale(surf, (WIDTH, HEIGHT))
    
    screen.blit(upscaled_surf, (0, 0))
    pygame.display.flip()

    # --- LÓGICA DE CAPTURA ---
    if SAVE_GIF and frame_count < MAX_FRAMES:
        # Capturamos la pantalla actual
        # Hacemos un subsampling [::2, ::2] para que el AMD A10 no sufra al procesar
        img = pygame.surfarray.array3d(screen)
        img = np.transpose(img, (1, 0, 2))[::2, ::2] 
        frames_list.append(img)
        frame_count += 1
        if frame_count % 30 == 0:
            print(f"Capturado {frame_count}/{MAX_FRAMES} frames...")

    clock.tick(60)

# --- GUARDADO AL FINALIZAR ---
if SAVE_GIF and len(frames_list) > 0:
    print("Exportando GIF... esto puede tomar un minuto en tu AMD A10.")
    imageio.mimsave('fluido_cuantico.gif', frames_list, fps=30, loop=0)
    print("¡Hecho! Archivo 'fluido_cuantico.gif' creado con éxito.")

pygame.quit()
sys.exit()
