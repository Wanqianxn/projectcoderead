import os, re, time, datetime, signal
from flask import Flask, jsonify, render_template, request, redirect, url_for, session, Response
from flask_jsglue import JSGlue
from werkzeug.utils import secure_filename
from shutil import copyfile
from tempfile import gettempdir
from threading import Thread

from helpers import *

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = set(['txt'])

# configure application
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
JSGlue(app)

@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response


def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS
  
         
@app.route("/")
def index():
    cleanup()
    return render_template("index.html")
    
@app.route("/acknowledgments")
def acknowledgments():
    cleanup()
    return render_template("acknowledgments.html")
    
@app.route("/contact")
def contact():
    cleanup()
    return render_template("contact.html")
    
@app.route("/map",  methods=["GET", "POST"])
def map():
    cleanup()
    if request.method == "POST":
        if 'inputfile' not in request.files:
           return render_template("map.html", nofile = True)
        file = request.files['inputfile']
        if file.filename == '':
            return render_template("map.html", nofile = True)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        for filename in os.listdir('uploads'):
            os.rename("uploads/"+filename, "uploads/input.txt")
        input = open("uploads/input.txt","r")
        counting = 0
        for line in input:
            for word in line.split():
                counting += 1
        if counting > 40000:
            for filename in os.listdir('uploads'):
                os.remove("uploads/"+filename)
            return render_template("map.html", toolong = True)
        modify()
        network()
        return render_template("mapcreate.html")
    return render_template("map.html")
    
@app.route("/map/genesis")
def mapgenesis():
    cleanup()
    return render_template("mapgenesis.html")
    
@app.route("/map/matthew")
def mapmatthew():
    cleanup()
    return render_template("mapmatthew.html")
    
@app.route("/map/inferno")
def mapinferno():
    cleanup()
    return render_template("mapinferno.html")
    
@app.route("/map/odyssey")
def mapodyssey():
    cleanup()
    return render_template("mapodyssey.html")
    
@app.route("/map/emma")
def mapemma():
    cleanup()
    return render_template("mapemma.html")
    
@app.route("/emotion",  methods=["GET", "POST"])
def emotion():
    cleanup()
    if request.method == "POST":
        if 'inputfile' not in request.files:
           return render_template("emotion.html", nofile = True)
        file = request.files['inputfile']
        if file.filename == '':
            return render_template("emotion.html", nofile = True)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        for filename in os.listdir('uploads'):
            os.rename("uploads/"+filename, "uploads/input.txt")
        input = open("uploads/input.txt","r")
        counting = 0
        for line in input:
            for word in line.split():
                counting += 1
        if counting > 40000:
            for filename in os.listdir('uploads'):
                os.remove("uploads/"+filename)
            return render_template("emotion.html", toolong = True)
        emodify()
        spectrums = spectrum()
        return render_template("emotioncreate.html", anger = spectrums[0], anti = spectrums[1], joy = spectrums[2], disgust = spectrums[3], sad = spectrums[4], fear = spectrums[5])
    return render_template("emotion.html")
    
@app.route("/emotion/emma")
def emotionemma():
    cleanup()
    return render_template("emotionemma.html")
    
@app.route("/emotion/odyssey")
def emotionodyssey():
    cleanup()
    return render_template("emotionodyssey.html")
    
@app.route("/emotion/inferno")
def emotioninferno():
    cleanup()
    return render_template("emotioninferno.html")
    
@app.route("/emotion/matthew")
def emotionmatthew():
    cleanup()
    return render_template("emotionmatthew.html")
    
@app.route("/emotion/genesis")
def emotiongenesis():
    cleanup()
    return render_template("emotiongenesis.html")

@app.route("/genre",  methods=["GET", "POST"])
def genre():
    cleanup()
    if request.method == "POST":
        if 'inputfile' not in request.files:
           return render_template("genre.html", nofile = True)
        file = request.files['inputfile']
        if file.filename == '':
            return render_template("genre.html", nofile = True)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        for filename in os.listdir('uploads'):
            os.rename("uploads/"+filename, "uploads/input.txt")
        input = open("uploads/input.txt","r")
        counting = 0
        for line in input:
            for word in line.split():
                counting += 1
        if counting > 40000:
            for filename in os.listdir('uploads'):
                os.remove("uploads/"+filename)
            return render_template("genre.html", toolong = True)
        gmodify()
        (mean,sigma,ratio) = metrics()
        return render_template("genrecreate.html", mean = mean, sigma = sigma, ratio = ratio)
    return render_template("genre.html")

@app.route("/genre/visual")
def genrevisual():
    cleanup()
    return render_template("genrevisual.html")
    
@app.route("/create",  methods=["GET", "POST"])
def create():
    cleanup()
    if request.method == "POST":
        if 'inputfile' not in request.files:
           return render_template("create.html", nofile = True)
        file = request.files['inputfile']
        if file.filename == '':
            return render_template("create.html", nofile = True)
        if file and allowed_file(file.filename):
            filename = secure_filename(file.filename)
            file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
        for filename in os.listdir('uploads'):
            os.rename("uploads/"+filename, "uploads/input.txt")
        input = open("uploads/input.txt","r")
        counting = 0
        for line in input:
            for word in line.split():
                counting += 1
        if counting > 40000:
            for filename in os.listdir('uploads'):
                os.remove("uploads/"+filename)
            return render_template("create.html", toolong = True)
        return render_template("createcustom.html")
    return render_template("create.html")
    
@app.route("/create/genesis")
def creategenesis():
    return render_template("creategenesis.html")
    
@app.route("/create/matthew")
def creatematthew():
    return render_template("creatematthew.html")
    
@app.route("/create/inferno")
def createinferno():
    return render_template("createinferno.html")
    
@app.route("/create/odyssey")
def createodyssey():
    return render_template("createodyssey.html")
    
@app.route("/create/emma")
def createemma():
    return render_template("createemma.html")
    
@app.route('/writeupdate')
def writeupdate():
    obtainer = obtain()
    string = ''''''
    for item in obtainer:
        string += item
        string += ''' '''
        string += '''
                      '''
    return jsonify(result=string)
    
@app.route('/writestory')
def writestory():
    name = request.args.get('s')
    write(name)

if __name__ == '__main__':
    app.run()
    return jsonify(result=0)
        