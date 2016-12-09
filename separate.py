def write(name):
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
        return txt
      
      for param, dparam, mem in zip([Wxh, Whh, Why, bh, by], 
                                    [dWxh, dWhh, dWhy, dbh, dby], 
                                    [mWxh, mWhh, mWhy, mbh, mby]):
        mem += dparam * dparam
        param += -learning_rate * dparam / numpy.sqrt(mem + 1e-8) 
    
      p += seq_length 
      n += 1