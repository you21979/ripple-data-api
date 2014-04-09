var winston = require('winston'),
  moment    = require('moment'),
  _         = require('lodash'),
  tools     = require('../utils');
  
  
/**
 *  accountTransactions returns transactions in which an account sent or received an amount.
 * 
 *  expects req.body to have:
 *  {
 *    account: //ripple address of the account to query
 *    startTime: (any momentjs-readable date), // optional
 *    endTime: (any momentjs-readable date), // optional
 *    descending: true/false, // optional, defaults to true
 *    limit  : limit the number of responses, ignored if time increment is set or reduce is true
 *    offset : offset by n transactions for pagination
 *    format : 'json', 'csv'   // optional
 *  }
 * 

 curl -H "Content-Type: application/json" -X POST -d '{
      "startTime" : "jan 1, 2014 10:00 am",
      "endTime"   : "jan 10, 2015 10:00 am",
      "account"   : "r3kmLJN5D28dHuH8vZNUZpMC43pEHpaocV",
      "format"    : "json"
      
    }' http://localhost:5993/api/accountTransactions
    
 curl -H "Content-Type: application/json" -X POST -d '{
      "startTime" : "jan 1, 2014 10:00 am",
      "endTime"   : "jan 10, 2015 10:00 am",
      "account"   : "r3kmLJN5D28dHuH8vZNUZpMC43pEHpaocV",
      "format"    : "csv"
      
    }' http://localhost:5993/api/accountTransactions
    
 curl -H "Content-Type: application/json" -X POST -d '{
      "startTime"  : "jan 1, 2014 10:00 am",
      "endTime"    : "jan 10, 2015 10:00 am",
      "account"    : "r3kmLJN5D28dHuH8vZNUZpMC43pEHpaocV",
      "limit"      :  10,
      "descending" : true,
      "format"     : "csv"
      
    }' http://localhost:5993/api/accountTransactions
    
 * 
 */

function accountTransactions( req, res ) {

  var viewOpts = {};

  if (!req.body.account) return res.send(500, { error: "please provide a valid ripple account"});
  var account = req.body.account; 
  
  //Parse start and end times
  var range = tools.parseTimeRange(req.body.startTime, req.body.endTime, req.body.descending);
  
  if (range.error)  return res.send(500, { error: range.error });  
  if (!range.start) range.start = moment.utc(0);
  if (!range.end)   range.end   = moment.utc();
  
  // set startkey and endkey for couchdb query
  viewOpts.startkey = [account].concat(range.start.toArray().slice(0,6));
  viewOpts.endkey   = [account].concat(range.end.toArray().slice(0,6));
  
  if (req.body.descending) viewOpts.descending = true;
  
  viewOpts.reduce = false; //view has no reduce function
  
  if (viewOpts.reduce===false) {
    if (req.body.limit  && !isNaN(req.body.limit))  viewOpts.limit = parseInt(req.body.limit, 10);
    if (req.body.offset && !isNaN(req.body.offset)) viewOpts.skip  = parseInt(req.body.offset, 10);
  }
  
  viewOpts.stale = "ok"; //dont wait for updates
  
  db.view('accountTransactions', 'v1', viewOpts, function(err, couchRes){

    if (err) {
      winston.error('Error with request: ' + err);
      res.send(500, { error: err });
      return;
    }
  
    handleResponse(couchRes.rows);
  });
/*
 * handleResponse - format the data according to the requirements
 * of the request and return it to the caller.
 * 
 */  
  function handleResponse (rows) {
        
    var response, stats = {}, transactions = [];

    if (req.body.format === 'json') {
      
      rows.forEach( function( row, index ) {
        var value = row.value;
        
        //value[0] = currency
        //value[1] = issuer
        //value[2] = sent or recieved
        //value[3] = amount
        //value[4] = counterparty
        
        if (value[0]=='XRP') {
          if (!stats[value[0]])           stats[value[0]] = {};
          if (!stats[value[0]][value[2]]) stats[value[0]][value[2]] = {amount:0, count:0};
          stats[value[0]][value[2]]['amount'] += value[3];
          stats[value[0]][value[2]]['count']++;
          
          
        } else {
          if (!stats[value[0]])                     stats[value[0]] = {};
          if (!stats[value[0]][value[1]])           stats[value[0]][value[1]] = {};
          if (!stats[value[0]][value[1]][value[2]]) stats[value[0]][value[1]][value[2]] = {amount:0, count:0};
          stats[value[0]][value[1]][value[2]]['amount'] += value[3];
          stats[value[0]][value[1]][value[2]]['count']++;
        }
        
        transactions.push({
          currency     : value[0],
          issuer       : value[1],
          type         : value[2],
          amount       : value[3],
          counterparty : value[4],
          time         : moment.utc(value[5]).format(),
          txHash       : value[6],
          ledgerIndex  : parseInt(row.id, 10),
        });
      });
      
      response = {
        account        : account,
        startTime      : range.start.format(),
        endTime        : range.end.format(),
        summary        : stats,
        transactions   : transactions
      }
      
      res.send(response);
      
    } else {
        response = [["currency","issuer","type","amount","counterparty","time","txHash","ledgerIndex"]];
        rows.forEach( function( row, index ) {
          response.push([
            row.value[0],
            row.value[1],
            row.value[2],
            row.value[3],
            row.value[4],
            moment.utc(row.value[5]).format(),
            row.value[6],
            parseInt(row.id, 10),
          ]);
        });
              
      if (req.body.format == 'csv') {
        var csvStr = _.map(response, function(row){
          return row.join(', ');
        }).join('\n');

        // provide output as CSV
        res.end(csvStr);   
           
      } else {
        
        //default response
        res.send(response);
      }
    }
  }
}


module.exports = accountTransactions;