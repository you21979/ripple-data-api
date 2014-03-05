var env    = process.env.NODE_ENV || "development";
var DBconfig = require('../db.config.json')[env];
var config   = require('../deployment.environments.json')[env];

//local vars
var winston = require('winston'),
  _         = require('lodash'),
  express   = require('express'),
  app       = express();
  
if (!config)   return winston.info('Invalid environment: ' + env);
if (!DBconfig) return winston.info('Invalid DB config: '+env);

//global vars
db = require('nano')(DBconfig.protocol+
  '://' + DBconfig.username + 
  ':'   + DBconfig.password + 
  '@'   + DBconfig.host + 
  ':'   + DBconfig.port + 
  '/'   + DBconfig.database);

gatewayList = require('./gateways.json');
  // TODO find permanent location for gateways list
  // should the gateways json file live in couchdb?

DATEARRAY  = ['YYYY', '-MM', '-DD', 'THH', ':mm', ':ssZZ'];
DATEFORMAT = DATEARRAY.join('');
  


var apiRoutes = {
  'offersexercised'       : require("./routes/offersExercised"),
  'topmarkets'            : require("./routes/topMarkets"),
  'accountscreated'       : require("./routes/accountsCreated"),
  'issuercapitalization'  : require("./routes/issuerCapitalization"),
  'exchangerates'         : require("./routes/exchangeRates"),
  'valueSent'             : require("./routes/valueSent"),
  'gettransaction'        : require("./routes/getTransaction"), //is this useable?
};


// enable CORS
var allowCrossDomain = function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Content-Length, X-Requested-With');

  // intercept OPTIONS method
  if ('OPTIONS' == req.method) res.send(200);
  else next();
};


app.use(allowCrossDomain);
app.use(express.bodyParser()); // TODO use express.json() instead of bodyParser
app.post('/api/*', requestHandler);
app.listen(config.port);
winston.info('Listening on port ' + config.port);


//function to handle all incoming requests
function requestHandler(req, res) {
  var path = req.path.slice(5),
    apiRoute;
  
  if (path.indexOf('/') !== -1)  
        apiRoute = path.slice(0, path.indexOf('/')).toLowerCase();
  else  apiRoute = path.toLowerCase();
  
  
  if (apiRoutes[apiRoute]) apiRoutes[apiRoute](req, res);
  else {
    
    res.send(404, 'Sorry, that API route doesn\'t seem to exist.'+
      ' Available paths are: ' + 
      Object.keys(apiRoutes).join(', ') + '\n');
  } 
}







