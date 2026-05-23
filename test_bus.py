import cv2
from PySide6.QtWidgets import QApplication
import sys

print("before app")
app = QApplication(sys.argv)
print("app created")
cap = cv2.VideoCapture(0)
print("cap created")
ret, frame = cap.read()
print("read", ret)
cap.release()
print("released")
