package com.kashnode.app
import android.content.Intent
import android.os.Bundle
import android.os.Build
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.*
import androidx.compose.foundation.layout.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.unit.dp
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import com.kashnode.app.data.local.AuthPreferences
import com.kashnode.app.data.remote.*
import com.kashnode.app.telephony.KeepAliveService
import com.kashnode.app.ui.*
import kotlinx.coroutines.launch
class MainActivity:ComponentActivity(){
 override fun onCreate(savedInstanceState:Bundle?){super.onCreate(savedInstanceState);val auth=AuthPreferences(this);val prefs=getSharedPreferences("server_config",MODE_PRIVATE);setContent{MaterialTheme(colorScheme=darkColorScheme()){
 var url by remember{mutableStateOf(prefs.getString("base_url",BuildConfig.DEFAULT_API_BASE_URL)?:BuildConfig.DEFAULT_API_BASE_URL)}
 var logged by remember{mutableStateOf(auth.session()!=null)};var scan by remember{mutableStateOf(false)};var settings by remember{mutableStateOf(false)};val scope= rememberCoroutineScope()
 val effectiveUrl=if(url.startsWith("https://")||url.startsWith("http://10.0.2.2/"))url else BuildConfig.DEFAULT_API_BASE_URL
 val api= remember(effectiveUrl){ApiClient.create(this,effectiveUrl,auth)}
 val repo= remember(api){SessionRepository(this,auth,api)}
 when{logged&&settings->Column(Modifier.fillMaxSize().padding(24.dp)){TextButton(onClick={settings=false}){Text("Back")};Text("Device Settings",style=MaterialTheme.typography.headlineSmall);Row(verticalAlignment=Alignment.CenterVertically,horizontalArrangement=Arrangement.SpaceBetween,modifier=Modifier.fillMaxWidth()){Text("Auto-Dial Mode");Switch(checked=auth.autoDialEnabled(),onCheckedChange={auth.setAutoDialEnabled(it)})};Text(if(auth.autoDialEnabled())"Pending order calls can be dialed automatically when the call queue is connected." else "Manual confirmation mode is selected.");Text("Primary Call SIM",modifier=Modifier.padding(top=16.dp));Row{FilterChip(selected=auth.primaryCallSimSlot()==0,onClick={auth.setPrimaryCallSimSlot(0)},label={Text("SIM 1")});Spacer(Modifier.width(8.dp));FilterChip(selected=auth.primaryCallSimSlot()==1,onClick={auth.setPrimaryCallSimSlot(1)},label={Text("SIM 2")})}}
 logged&&!scan->Box(Modifier.fillMaxSize()){DashboardWebView(effectiveUrl,api,Modifier.fillMaxSize()){logged=false;auth.clear()};TextButton(onClick={settings=true},modifier=Modifier.align(Alignment.TopEnd)){Text("Settings")}}
 scan->QrScanner({token->scan=false;scope.launch{runCatching{repo.pair(token);logged=true}}},{scan=false})
 else->LoginScreen(url,{url=it;prefs.edit().putString("base_url",it).apply()},{logged=true},repo){scan=true}}
 }}}
 override fun onStart(){super.onStart();if(AuthPreferences(this).session()!=null){if(Build.VERSION.SDK_INT>=26)startForegroundService(Intent(this,KeepAliveService::class.java))else startService(Intent(this,KeepAliveService::class.java))}}
}
