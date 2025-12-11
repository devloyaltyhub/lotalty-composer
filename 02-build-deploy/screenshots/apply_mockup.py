#!/usr/bin/env python3
"""
Processa screenshot aplicando cantos arredondados.

Versão simplificada sem frame de dispositivo.
Os mockups são gerados apenas com cantos arredondados,
e o background com gradiente/curvas é adicionado pelo ImageMagick posteriormente.
"""

import sys
import cv2
import numpy as np
from PIL import Image
import json
import os

# Import configuration constants
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'screenshots'))
from config.screenshot_config import ScreenshotConfig, DeviceConfig, get_interpolation_method, get_border_mode

def load_template_config(template_dir, template_slug):
    """Carrega configuração do template"""
    index_path = os.path.join(template_dir, 'index.json')

    with open(index_path, 'r') as f:
        config = json.load(f)

    # Procurar template pelo slug
    for template in config.get('templates', []):
        if template['slug'] == template_slug:
            return template

    raise ValueError(f"Template '{template_slug}' não encontrado")

def apply_rounded_corners_simple(image, corner_radius):
    """
    Aplica cantos arredondados a uma imagem.

    Args:
        image: numpy array BGRA
        corner_radius: raio dos cantos em pixels

    Returns:
        Imagem com cantos arredondados aplicados
    """
    h, w = image.shape[:2]
    radius = int(corner_radius)

    # Se o raio for muito pequeno, retornar imagem original
    if radius < ScreenshotConfig.MIN_CORNER_RADIUS:
        return image

    # Criar máscara com cantos arredondados
    corners_mask = np.ones((h, w), dtype=np.uint8) * ScreenshotConfig.MASK_VALUE_ALLOW

    # Top-left corner
    if radius < min(h, w):
        corners_mask[0:radius, 0:radius] = 0
        cv2.circle(corners_mask, (radius, radius), radius, 255, -1)

        # Top-right corner
        corners_mask[0:radius, w-radius:w] = 0
        cv2.circle(corners_mask, (w - radius - 1, radius), radius, 255, -1)

        # Bottom-left corner
        corners_mask[h-radius:h, 0:radius] = 0
        cv2.circle(corners_mask, (radius, h - radius - 1), radius, 255, -1)

        # Bottom-right corner
        corners_mask[h-radius:h, w-radius:w] = 0
        cv2.circle(corners_mask, (w - radius - 1, h - radius - 1), radius, 255, -1)

        # Aplicar suavização para evitar bordas serrilhadas
        corners_mask = cv2.GaussianBlur(
            corners_mask,
            ScreenshotConfig.BLUR_KERNEL_SIZE,
            ScreenshotConfig.BLUR_SIGMA
        )

    # Aplicar máscara no canal alpha
    result = image.copy()
    original_alpha = result[:, :, 3]
    masked_alpha = cv2.bitwise_and(original_alpha, corners_mask)
    result[:, :, 3] = masked_alpha

    return result

def resize_to_fit(screenshot, target_width, target_height, corner_radius=0):
    """
    Redimensiona screenshot para caber na área alvo, mantendo aspect ratio.
    Centraliza e adiciona padding transparente se necessário.
    Opcionalmente aplica cantos arredondados.

    Args:
        screenshot: numpy array do screenshot (BGRA)
        target_width: largura alvo
        target_height: altura alvo
        corner_radius: raio dos cantos arredondados (0 = sem arredondamento)

    Returns:
        Screenshot redimensionado e centralizado (com cantos arredondados se especificado)
    """
    h, w = screenshot.shape[:2]
    screenshot_aspect = w / h
    target_aspect = target_width / target_height

    # Calcular novas dimensões mantendo aspect ratio
    if screenshot_aspect > target_aspect:
        # Screenshot é mais largo, ajustar pela largura
        new_width = target_width
        new_height = int(target_width / screenshot_aspect)
    else:
        # Screenshot é mais alto, ajustar pela altura
        new_height = target_height
        new_width = int(target_height * screenshot_aspect)

    # Redimensionar
    resized = cv2.resize(screenshot, (new_width, new_height), interpolation=get_interpolation_method())

    # Aplicar cantos arredondados se especificado
    if corner_radius > 0:
        resized = apply_rounded_corners_simple(resized, corner_radius)

    # Criar canvas com padding transparente
    canvas = np.zeros((target_height, target_width, 4), dtype=np.uint8)

    # Centralizar screenshot no canvas
    y_offset = (target_height - new_height) // 2
    x_offset = (target_width - new_width) // 2

    canvas[y_offset:y_offset+new_height, x_offset:x_offset+new_width] = resized

    return canvas

def apply_mockup(screenshot_path, template_dir, template_slug, output_path):
    """
    Processa screenshot aplicando cantos arredondados.

    Versão simplificada sem frame de dispositivo:
    1. Carrega screenshot
    2. Aplica cantos arredondados usando corner radius fixo
    3. Salva resultado

    O background com gradiente/curvas é adicionado posteriormente pelo ImageMagick.
    """
    # Carregar configuração do template (para corner_radius)
    template_config = load_template_config(template_dir, template_slug)

    print(f"📸 Carregando screenshot: {screenshot_path}")
    screenshot = cv2.imread(screenshot_path, cv2.IMREAD_UNCHANGED)
    if screenshot is None:
        raise ValueError(f"Não foi possível carregar screenshot: {screenshot_path}")

    # Garantir que screenshot tem canal alpha
    if screenshot.shape[2] == 3:
        screenshot = cv2.cvtColor(screenshot, cv2.COLOR_BGR2BGRA)

    # Usar corner radius da configuração ou valor padrão
    corner_radius = template_config.get('corner_radius', DeviceConfig.MOCKUP_CORNER_RADIUS)
    print(f"📐 Corner radius: {corner_radius}px")

    print(f"🔧 Aplicando cantos arredondados...")
    # Aplicar cantos arredondados diretamente no screenshot
    result = apply_rounded_corners_simple(screenshot, corner_radius)

    print(f"💾 Salvando resultado: {output_path}")
    cv2.imwrite(output_path, result)

    print(f"✅ Screenshot processado com sucesso!")
    return output_path

def main():
    if len(sys.argv) < 5:
        print("Uso: apply_mockup.py <screenshot> <template_dir> <template_slug> <output>")
        sys.exit(1)

    screenshot_path = sys.argv[1]
    template_dir = sys.argv[2]
    template_slug = sys.argv[3]
    output_path = sys.argv[4]

    apply_mockup(screenshot_path, template_dir, template_slug, output_path)

if __name__ == '__main__':
    main()
