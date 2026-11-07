package com.kashnode.app.ui
import android.webkit.CookieManager
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import com.kashnode.app.data.remote.KashNodeApi
import kotlinx.coroutines.launch
@Composable fun DashboardWebView(baseUrl:String,api:KashNodeApi,modifier:Modifier=Modifier,onSessionExpired:()->Unit){
 val scope= rememberCoroutineScope();AndroidView(modifier=modifier,factory={ctx->WebView(ctx).apply{settings.javaScriptEnabled=true;settings.domStorageEnabled=true;settings.allowFileAccess=false;settings.allowContentAccess=false;webViewClient=WebViewClient()
 scope.launch{runCatching{val r=api.webSession();if(!r.isSuccessful){onSessionExpired();return@runCatching};val setCookie=r.headers()["Set-Cookie"]?:error("Missing secure WebView cookie");val cm=CookieManager.getInstance();cm.setAcceptCookie(true);cm.setCookie(baseUrl.trimEnd('/'),setCookie){ok->if(ok){cm.flush();loadUrl(baseUrl.trimEnd('/')+(r.body()?.dashboard_url?: "/dashboard"))}else onSessionExpired()}}.onFailure{onSessionExpired()}}
 }})
}
