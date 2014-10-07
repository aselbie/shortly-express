var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var expressSession = require('express-session');
var bcrypt = require('bcrypt');

var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var linkController = require ('./app/controllers/link.controller');

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));


app.use(expressSession({secret: 'noOneKnows'}));
app.use(cookieParser());


app.get('/', restrict,
function(req, res) {
  res.render('index');
});

app.get('/login',
function(req, res) {
  res.render('login');
});

app.get('/signup',
function(req, res) {
  res.render('signup');
});

app.get('/create', restrict,
function(req, res) {
  res.render('index');
});

app.get('/links', restrict,
function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});

app.post('/links', linkController.post);


/************************************************************/
// Write your authentication routes here
/************************************************************/

function restrict(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    req.session.error = 'Access denied!';
    res.redirect('/login');
  }
}


app.post('/signup',
function(req, res) {
  var uri = req.body.url;

  new User({username: req.body.username})
    .fetch()
    .then(function(user){
      if (user) {
        req.session.user=true;
        res.redirect('/');
      } else {
        bcrypt.genSalt(10, function(err, salt) {
            bcrypt.hash("B4c0/\/", salt, function(err, hash) {
                new User({
                  username: req.body.username,
                  password: hash
                }).save().then(function(user){
                  req.session.user=true;
                  res.redirect('/');
                });
            });
        });
      }
    });
});
app.post('/login',
function(req, res) {
  var uri = req.body.url;

  new User({username:req.body.username})
    .fetch()
    .then(function(user){
      console.log('------------',user);
      if (user) {
        bcrypt.compare(req.body.password, user.attributes.password, function(err, res) {
          if (err) {res.redirect('/login');}
          req.session.user=true;
          res.redirect('/');
        });
      } else {
        console.log('wrong username or password!! Sign up below');
        res.redirect('/login');
      }
    });
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('urls')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);
