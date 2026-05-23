import cv2
from PySide6.QtCore import QThread
from PySide6.QtWidgets import QApplication
import sys

class CamThread(QThread):
    def run(self):
        print("Starting cam")
        cap = cv2.VideoCapture(0)
        print("Opened:", cap.isOpened())
        cap.release()

app = QApplication(sys.argv)
t = CamThread()
t.start()
app.exec()
