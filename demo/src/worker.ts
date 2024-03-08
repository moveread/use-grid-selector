import cv from "opencv-ts";
import { onMessage } from 'use-grid-selector/worker'

onmessage = onMessage(cv)