import cv2
from PySide6.QtCore import QThread
from PySide6.QtWidgets import QApplication
import sys

class CamThread(QThread):
    def __init__(self, cap):
        super().__init__()
        self.cap = cap
    def run(self):
        print("reading in thread")
        for i in range(10):
            ret, frame = self.cap.read()
        print("read ok")

app = QApplication(sys.argv)
cap = cv2.VideoCapture(0)
t = CamThread(cap)
t.start()
t.wait()
cap.release()
print("done")
