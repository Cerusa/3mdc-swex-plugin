const request = require('request');
const fs = require('fs');
const path = require('path');
const pluginName = '3DMCLogger';
var wizardBattles = [];
var sendBattles = [];

//Target Format
/*

sendBattles =
{
    "wizard_id": 0,
	"wizard_name":"",
    "battleType": "",
	"battleKey":0,
	"command":"",
    "battleDateTime": 0,
    "defense": {
        "units": [
            0,
            0,
            0
        ]
    },
    "counter": {
        "units": [
            0,
            0,
            0
        ]
    },
    "win_lose": 1,
	"battleRank":0
};
*/
module.exports = {
  defaultConfig: {
    enabled: true,
    saveToFile: false,
	logGuildWar: true,
	logSiegeBattle: false
  },
  defaultConfigDetails: {
    saveToFile: {label: 'Save to file as well?'},
	logGuildWar: {label: 'Log Guild War Battles to Public 3MDC'},
	logSiegeBattle: {label: 'Log Siege Battles to Public 3MDC'}
  },
  pluginName,
  pluginDescription: 'Automatically upload GW and Siege attacks and log defense+counter win/loss to public 3MDC. ',
  init(proxy, config) {
    cache={};

    var listenToCommands = [
      //Guild War-
      'BattleGuildWarStart', //offense and defense mons
      'BattleGuildWarResult', //win/loss
	  'GetGuildWarMatchupInfo', //rating_id

      //Siege
      'BattleGuildSiegeStart_v2',
      'BattleGuildSiegeResult',
	  'GetGuildSiegeMatchupInfo'
    ];

    for(var commandIndex in listenToCommands){
      var command = listenToCommands[commandIndex];
        proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: "Binding to command: "+command });
        proxy.on(command, (req, resp) => {
          this.processRequest(command,proxy,config,req,resp,cache);
        });
    }
  },
  hasAPISettings(config){
    if (!config.Config.Plugins[pluginName].enabled) return false;
    return true;
  },
  processRequest(command, proxy, config, req, resp, cache) {
		if(resp['command'] == 'GetGuildWarMatchupInfo'){
			//If wizard id and rating doesn't exist in wizardBattles[] then push to it
			try{
			wizardInfo = {}
			wizardFound = false;
			for (var k = wizardBattles.length - 1;k>=0;k--){
				if(wizardBattles[k].wizard_id==req['wizard_id']) {
					//update rating id
					wizardBattles[k].guild_rating_id = resp['guildwar_match_info']['guild_rating_id'];
					wizardBattles[k].sendBattles = [];
					wizardFound = true;
				}
			}
			if(!wizardFound) {
				wizardInfo.wizard_id = req['wizard_id'];
				wizardInfo.guild_rating_id = resp['guildwar_match_info']['guild_rating_id'];
				wizardInfo.sendBattles = [];
				wizardBattles.push(wizardInfo);
			}
			} catch(e) {
				proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
			}
		}
		if(resp['command'] == 'GetGuildSiegeMatchupInfo'){
			//If wizard id and rating doesn't exist in wizardBattles[] then push to it
			try{
			wizardInfo = {}
			wizardFound = false;
			for (var k = wizardBattles.length - 1;k>=0;k--){
				if(wizardBattles[k].wizard_id==req['wizard_id']) {
					wizardBattles[k].siege_rating_id = resp['match_info']['rating_id'];
					wizardBattles[k].sendBattles = [];
					wizardFound = true;
				}
			}
			if(!wizardFound) {
				wizardInfo.wizard_id = req['wizard_id'];
				wizardInfo.siege_rating_id = resp['match_info']['rating_id'];
				wizardInfo.sendBattles = [];
				wizardBattles.push(wizardInfo);
			}
			} catch(e) {
				proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
			}
		}
		if(resp['command'] == 'BattleGuildWarStart' ){
		  //Store only the information needed for transfer
		  try{
		for (var i = 0; i<2;i++){
        battle = {}
        battle.command = "3MDCBattleLog";
        battle.battleType = "GuildWar";
        battle.wizard_id = resp.wizard_info.wizard_id;
        battle.wizard_name = resp.wizard_info.wizard_name;
        battle.battleKey = resp.battle_key;
			battle.defense = {}
			battle.counter = {}
			  
			  //prepare the arrays
			  units = [];
			  battle.defense.units = [];
			  battle.counter.units = [];
			  for (var j = 0; j <3;j++){
				  try{
					  //Offense Mons
					  battle.counter.units.push(resp.guildwar_my_unit_list[i][j].unit_master_id);
            
						//Defense Mons
					  battle.defense.units.push(resp.guildwar_opp_unit_list[i][j].unit_info.unit_master_id);
				  } catch (e) {}
			  }
			  //match up wizard id and push the battle
			  for (var k = wizardBattles.length - 1;k>=0;k--){
				if(wizardBattles[k].wizard_id==req['wizard_id']) {
					//store battle in array
					battle.battleRank = wizardBattles[k].guild_rating_id;
					wizardBattles[k].sendBattles.push(battle);
					}
				}
			}
			} catch(e) {
				proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
			}
		}
	  if(resp['command'] == 'BattleGuildSiegeStart_v2' ){
		  try{
        battle = {}
        battle.command = "3MDCBattleLog";
        battle.battleType = "Siege";
        battle.wizard_id = resp.wizard_info.wizard_id;
        battle.wizard_name = resp.wizard_info.wizard_name;
        battle.battleKey = resp.battle_key;
				battle.defense = {}
				battle.counter = {}
			  
			  //prepare the arrays
			  units = [];
			  battle.defense.units = [];
			  battle.counter.units = [];
			  for (var j = 0; j <3;j++){
				  try {
				    //Offense Mons
					battle.counter.units.push(resp.guildsiege_my_unit_list[j].unit_master_id);
            
				    //Defense Mons
				    battle.defense.units.push(resp.guildsiege_opp_unit_list[j].unit_info.unit_master_id);
				  } catch (e) {}
			  }
			  //match up wizard id and push the battle
			  for (var k = wizardBattles.length - 1;k>=0;k--){
				if(wizardBattles[k].wizard_id==req['wizard_id']) {
					//store battle in array
					battle.battleRank = wizardBattles[k].siege_rating_id;
					wizardBattles[k].sendBattles.push(battle);
					}
				}
				} catch(e) {
				proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `${resp['command']}-${e.message}` });
			}
    }
	  if(req['command'] == 'BattleGuildWarResult' && logGuildWar){
		  var j = 1;
      try {//Handle out of order processing
		  for (var wizard in wizardBattles){
			for (var k = wizardBattles[wizard].sendBattles.length - 1;k>=0;k--){
			  if (wizardBattles[wizard].sendBattles[k].battleKey == req['battle_key']){
				  wizardBattles[wizard].sendBattles[k].win_lose = req['win_lose_list'][j];
				  wizardBattles[wizard].sendBattles[k].battleDateTime = resp.tvalue - j;
				  j--;
				  sendResp = wizardBattles[wizard].sendBattles[k];
				  //remove battle from the sendBattlesList
				  wizardBattles[wizard].sendBattles.splice(k,1);
				  //if result then add time and win/loss then send to webservice
				  if (sendResp.defense.units.length == 3 && sendResp.counter.units.length == 3 && sendResp.battleRank >= 4000) {
					this.writeToFile(proxy, req, sendResp);
					
					this.uploadToWebService(proxy, config, req, sendResp);
					proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `GW Battle End Processed ${k}` });
				  }
			  }
			}
		  }
      } catch (e) {
		  proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `GW Battle End Error ${e.message}` });
	  }
		  if(j==1){
		  j=0;
		  }
    }
    
	  if( req['command'] == 'BattleGuildSiegeResult' && logSiegeBattle){
		  var j = 0;
      try {//Handle out of order processing
		  for (var wizard in wizardBattles){
			for (var k = wizardBattles[wizard].sendBattles.length - 1;k>=0;k--){
			  //TODO: Handle multiple accounts with GW and Siege going at the same time. match battlekey and wizard. then do battles 1 and 2 and delete from the mon list.
			  if (wizardBattles[wizard].sendBattles[k].battleKey == req['battle_key']){
				  wizardBattles[wizard].sendBattles[k].win_lose = req['win_lose'];
				  wizardBattles[wizard].sendBattles[k].battleDateTime = resp.tvalue - j;
				  j++;
				  sendResp = wizardBattles[wizard].sendBattles[k];
				  //remove battle from the sendBattlesList
				  wizardBattles[wizard].sendBattles.splice(k,1);
				  //if 3 mons in offense and defense then send to webservice
				  if (sendResp.defense.units.length == 3 && sendResp.counter.units.length == 3 && sendResp.battleRank >= 4000) {
					this.writeToFile(proxy, req, sendResp);
					
					this.uploadToWebService(proxy, config, req, sendResp);
					proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Siege Battle End Processed ${k}` });
				  }
			  }
			}
		  }
      } catch (e) {
		  proxy.log({ type: 'debug', source: 'plugin', name: this.pluginName, message: `Siege Battle End Error ${e.message}` });
		  }
		if(j==1){
		  j=0;
		  }
    }
	},
  uploadToWebService(proxy, config, req, resp) {
    if(!this.hasAPISettings(config)) return;
    const { command } = req;

    let options = {
      method: 'post',
      uri: 'https://swgt.io/api/3mdc/v1',
      json: true,
      body: resp
    };

    request(options, (error, response) => {
      if (error) {
        proxy.log({ type: 'error', source: 'plugin', name: this.pluginName, message: `Error: ${error.message}` });
        return;
      }

      if (response.statusCode === 200) {
        proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: `${command} uploaded successfully` });
      } else {
        proxy.log({
          type: 'error',
          source: 'plugin',
          name: this.pluginName,
          message: `Upload failed: Server responded with code: ${response.statusCode} = ${response.body}`
        });
      }
    });
  },
  writeToFile(proxy, req, resp) {
    if(!config.Config.Plugins[pluginName].enabled) return;
    if(!config.Config.Plugins[pluginName].saveToFile) return;
    let filename = pluginName+'-'+resp['command']+'-'+resp['battleDateTime']+'-'+new Date().getTime()+'.json';
    let outFile = fs.createWriteStream(path.join(config.Config.App.filesPath, filename), {
      flags: 'w',
      autoClose: true
    });

    outFile.write(JSON.stringify(resp, true, 2));
    outFile.end();
    proxy.log({ type: 'success', source: 'plugin', name: this.pluginName, message: 'Saved data to '.concat(filename) });
  }
};