package com.kashnode.app.ui
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import com.kashnode.app.data.remote.SessionRepository
import kotlinx.coroutines.launch
@Composable fun LoginScreen(serverUrl:String,onServerUrlChange:(String)->Unit,onAuthenticated:()->Unit,repo:SessionRepository,onScanQr:()->Unit){
 var tab by remember{mutableIntStateOf(0)};var email by remember{mutableStateOf("")};var password by remember{mutableStateOf("")};var error by remember{mutableStateOf<String?>(null)};var busy by remember{mutableStateOf(false)};val scope= rememberCoroutineScope()
 Column(Modifier.fillMaxSize().background(Color(0xFF090D16)).padding(24.dp),verticalArrangement=Arrangement.Center){
 Text("KashNode",style=MaterialTheme.typography.headlineLarge,color=Color.White);Text("Merchant device • Secure sign in",color=Color(0xFF9AA7BA));Spacer(Modifier.height(24.dp))
 OutlinedTextField(serverUrl,onServerUrlChange,label={Text("Server URL")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(16.dp))
 TabRow(tab){Tab(tab==0,{tab=0},text={Text("Email login")});Tab(tab==1,{tab=1},text={Text("Pair by QR")})};Spacer(Modifier.height(16.dp))
 if(tab==0){OutlinedTextField(email,{email=it},label={Text("Email")},singleLine=true,modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(8.dp));OutlinedTextField(password,{password=it},label={Text("Password")},singleLine=true,visualTransformation=PasswordVisualTransformation(),modifier=Modifier.fillMaxWidth());Spacer(Modifier.height(16.dp))
 Button(enabled=!busy&&email.isNotBlank()&&password.isNotBlank(),modifier=Modifier.fillMaxWidth(),onClick={scope.launch{busy=true;error=null;try{repo.login(email.trim(),password);onAuthenticated()}catch(e:Exception){error=e.message?: "Sign in failed"}finally{busy=false}}}){Text(if(busy)"Signing in…" else "Sign in")}
 }else{Text("Scan the one-time QR code generated in your KashNode dashboard. Codes expire after five minutes.",color=Color(0xFFCBD5E1));Spacer(Modifier.height(16.dp));Button(onClick=onScanQr,modifier=Modifier.fillMaxWidth()){Text("Open QR scanner")}}
 error?.let{Text(it,color=MaterialTheme.colorScheme.error)}
 }
}
