import os, re, time, signal
from flask import Flask, jsonify, render_template, request, redirect, url_for, Response
from flask_jsglue import JSGlue
from werkzeug.utils import secure_filename
from shutil import copyfile
#from celery import Celery
from redis import Redis
from rq import Queue
from worker import conn


from helpers import *
from separate import *

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = set(['txt'])

# Configure Flask application amd set parameters for uploaded files.
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

q = Queue(connection=conn)
app.jinja_env.globals['thedata'] = []

# General comments: For every page generated, a cleanup function is first executed on GET to clean the system free of uploaded files. For the pages with files to be uploaded, additional code for POST is written to vet those files, make sure they are of the right size before saving them to be processed and outputted.

# Index, Acknowledgments and Contact.         
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

# Map section.    
@app.route("/map",  methods=["GET", "POST"])
def map():
    cleanup()
    if request.method == "POST":
        # Below section checks for presence of file, as well as suitable length.
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
        # These functions help generate the actual graph.
        print("keep alive")
        modify()
        print("keep alive again")
        network()
        print("keep alive more")
        return render_template("mapcreate.html")
    return render_template("map.html")

# Map graphs generated for the example texts.    
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
    
# Emotion section.    
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
        # These functions generate the actual colormap.
        emodify()
        spectrums = spectrum()
        return render_template("emotioncreate.html", anger = spectrums[0], anti = spectrums[1], joy = spectrums[2], disgust = spectrums[3], sad = spectrums[4], fear = spectrums[5])
    return render_template("emotion.html")

# Emotion colormaps generated for the example texts.    
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

# Genre section.
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
        # Again, the actual functions that generated the bubble chart.
        emodify()
        (mean,sigma,ratio) = metrics()
        return render_template("genrecreate.html", mean = mean, sigma = sigma, ratio = ratio)
    return render_template("genre.html")

# Visualization of bubble chart.
@app.route("/genre/visual")
def genrevisual():
    cleanup()
    return render_template("genrevisual.html")
    
# Create section.
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

# Example texts for Create.
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

# Jsonify acts as the medium through which Javascript AJAX requests are sent to the Python server. Both the functions below are for the Create section.
@app.route('/writeupdate')
def writeupdate():
    d = request.args.get('d')
    if app.jinja_env.globals['thedata'] == []:
        thedata = fixed(d)
        hprev = numpy.zeros((100,1))
        thedata.append(hprev)
        txt = ''
        thedata.append(txt)
    else:
        thedata = app.jinja_env.globals['thedata']
    thedata[10],thedata[11],thedata[5],thedata[6],thedata[8],thedata[7],thedata[9],thedata[12],thedata[13],thedata[14],thedata[15],thedata[16],thedata[17],thedata[18], thedata[19] = iteration(d,thedata[10],thedata[11],thedata[1],thedata[18],thedata[3],thedata[17],thedata[4],thedata[2],thedata[5],thedata[6],thedata[8],thedata[7],thedata[9],thedata[12],thedata[13],thedata[14],thedata[15],thedata[16])
    app.jinja_env.globals['thedata'] = thedata
    resultt = "Iteration "+str(thedata[10])+": "+thedata[19].encode('utf-8').strip()
    return jsonify(result=resultt)
    
@app.route('/writerefresh')
def writerefresh(): 
    app.jinja_env.globals['thedata'] = []   
    return jsonify(result=1)    
    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
    os.system("nohup redis-server &")
        