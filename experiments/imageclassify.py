from transformers import pipeline #pretrained model for image classification

classifier = pipeline("image-classification", model="google/vit-base-patch16-224")
result = classifier("image.jpg")
print(result) # hi 