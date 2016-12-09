import os, re, time, signal
from flask import Flask, jsonify, render_template, request, redirect, url_for, Response
from flask_jsglue import JSGlue
from werkzeug.utils import secure_filename
from shutil import copyfile
from celery import Celery
from redis import Redis

from helpers import *

UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = set(['txt'])

# Configure Flask application amd set parameters for uploaded files.
app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
JSGlue(app)

currentiter =''

@app.after_request
def after_request(response):
    response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
    response.headers["Expires"] = 0
    response.headers["Pragma"] = "no-cache"
    return response

def allowed_file(filename):
    return '.' in filename and \
           filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS
           
redis_url = os.getenv('REDISTOGO_URL', 'redis://localhost:6379')
app.config.update(
    CELERY_BROKER_URL=redis_url,
    CELERY_RESULT_BACKEND=redis_url,
    BROKER_POOL_LIMIT = 9,
    CELERY_REDIS_MAX_CONNECTIONS = 9
)
 
def make_celery(app):
    celery = Celery(app.import_name, backend=app.config['CELERY_RESULT_BACKEND'],
                    broker=app.config['CELERY_BROKER_URL'])
    celery.conf.update(app.config)
    TaskBase = celery.Task
    class ContextTask(TaskBase):
        abstract = True
        def __call__(self, *args, **kwargs):
            with app.app_context():
                return TaskBase.__call__(self, *args, **kwargs)
    celery.Task = ContextTask
    return celery
    
celery = make_celery(app)

@celery.task()
#def write(name):
    data = open(name, 'r').read()
    chars = list(set(data))
    data_size, vocab_size = len(data), len(chars)
    char_to_ix = { ch:i for i,ch in enumerate(chars) }
    ix_to_char = { i:ch for i,ch in enumerate(chars) }

    # Hyper-paramters. These affect the speed at which the RNN generates iterations of text.
    hidden_size = 100
    seq_length = 25
    learning_rate = 1e-1
    
    Wxh = numpy.random.randn(hidden_size, vocab_size)*0.01
    Whh = numpy.random.randn(hidden_size, hidden_size)*0.01 
    Why = numpy.random.randn(vocab_size, hidden_size)*0.01 
    bh = numpy.zeros((hidden_size, 1)) 
    by = numpy.zeros((vocab_size, 1)) 
    
    def lossFun(inputs, targets, hprev):
      xs, hs, ys, ps = {}, {}, {}, {}
      hs[-1] = numpy.copy(hprev)
      loss = 0
      
      for t in range(len(inputs)):
        xs[t] = numpy.zeros((vocab_size,1)) 
        xs[t][inputs[t]] = 1
        hs[t] = numpy.tanh(numpy.dot(Wxh, xs[t]) + numpy.dot(Whh, hs[t-1]) + bh) 
        ys[t] = numpy.dot(Why, hs[t]) + by 
        ps[t] = numpy.exp(ys[t]) / numpy.sum(numpy.exp(ys[t])) 
        loss += -numpy.log(ps[t][targets[t],0]) #
        
      dWxh, dWhh, dWhy = numpy.zeros_like(Wxh), numpy.zeros_like(Whh), numpy.zeros_like(Why)
      dbh, dby = numpy.zeros_like(bh), numpy.zeros_like(by)
      dhnext = numpy.zeros_like(hs[0])
      for t in reversed(range(len(inputs))):
        dy = numpy.copy(ps[t])
        dy[targets[t]] -= 1 # 
        dWhy += numpy.dot(dy, hs[t].T)
        dby += dy
        dh = numpy.dot(Why.T, dy) + dhnext 
        dhraw = (1 - hs[t] * hs[t]) * dh 
        dbh += dhraw
        dWxh += numpy.dot(dhraw, xs[t].T)
        dWhh += numpy.dot(dhraw, hs[t-1].T)
        dhnext = numpy.dot(Whh.T, dhraw)
      for dparam in [dWxh, dWhh, dWhy, dbh, dby]:
        numpy.clip(dparam, -5, 5, out=dparam) 
      return loss, dWxh, dWhh, dWhy, dbh, dby, hs[len(inputs)-1]
    
    def sample(h, seed_ix, n):
      x = numpy.zeros((vocab_size, 1))
      x[seed_ix] = 1
      ixes = []
      for t in range(n):
        h = numpy.tanh(numpy.dot(Wxh, x) + numpy.dot(Whh, h) + bh)
        y = numpy.dot(Why, h) + by
        p = numpy.exp(y) / numpy.sum(numpy.exp(y))
        ix = numpy.random.choice(range(vocab_size), p=p.ravel())
        x = numpy.zeros((vocab_size, 1))
        x[ix] = 1
        ixes.append(ix)
      return ixes
    
    n, p = 0, 0
    mWxh, mWhh, mWhy = numpy.zeros_like(Wxh), numpy.zeros_like(Whh), numpy.zeros_like(Why)
    mbh, mby = numpy.zeros_like(bh), numpy.zeros_like(by)
    smooth_loss = -numpy.log(1.0/vocab_size)*seq_length 
    while True:
      if p+seq_length+1 >= len(data) or n == 0: 
        hprev = numpy.zeros((hidden_size,1)) 
        p = 0 
      inputs = [char_to_ix[ch] for ch in data[p:p+seq_length]]
      targets = [char_to_ix[ch] for ch in data[p+1:p+seq_length+1]]
    
      
      loss, dWxh, dWhh, dWhy, dbh, dby, hprev = lossFun(inputs, targets, hprev)
      smooth_loss = smooth_loss * 0.999 + loss * 0.001
     
      # Every 100 iterations, the results are printed out and compared to.
      if n % 100 == 0:
        sample_ix = sample(hprev, inputs[0], 200)
        txt = ''.join(ix_to_char[ix] for ix in sample_ix)
        currentiter = txt
        print("ASCASCAC " + currentiter)
      
      for param, dparam, mem in zip([Wxh, Whh, Why, bh, by], 
                                    [dWxh, dWhh, dWhy, dbh, dby], 
                                    [mWxh, mWhh, mWhy, mbh, mby]):
        mem += dparam * dparam
        param += -learning_rate * dparam / numpy.sqrt(mem + 1e-8) 
    
      p += seq_length 
      n += 1 
def write(name):
    currentiter = name
    print("NAME")
    return name


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
        modify()
        network()
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
    # This part forcibly stops the infinite while loop in writestory() by destroying and recreating the 'uploads' folder.
    for filename in os.listdir('uploads'):
        if filename.startswith("input"):
            os.remove("uploads/"+filename)
    os.rmdir("uploads")
    time.sleep(5)
    os.makedirs("uploads")
    
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
    yes = write.delay("static/create/genesis.txt")
    print(yes)
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
    print(currentiter + " AAA")
    return jsonify(result=currentiter)
    
    
if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
    os.system("nohup redis-server &")
        