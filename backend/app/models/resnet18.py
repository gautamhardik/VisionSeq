import torch.nn as nn
from torchvision import models

class ResNetCaptcha(nn.Module):
    """Modified ResNet-18 for grayscale 6-character CAPTCHA recognition."""
    def __init__(self, num_chars: int, seq_len: int = 6) -> None:
        super().__init__()
        backbone = models.resnet18(weights=None)
        backbone.conv1 = nn.Conv2d(
            1, 64, kernel_size=7, stride=2, padding=3, bias=False
        )
        self.features = nn.Sequential(
            backbone.conv1, backbone.bn1, backbone.relu, backbone.maxpool,
            backbone.layer1, backbone.layer2, backbone.layer3, backbone.layer4,
        )
        self.pool = nn.AdaptiveAvgPool2d((1, seq_len))
        self.classifier = nn.Linear(512, num_chars)

    def forward(self, x):
        x = self.features(x)
        x = self.pool(x)
        x = x.squeeze(2)
        x = x.permute(0, 2, 1)
        x = self.classifier(x)
        return x
