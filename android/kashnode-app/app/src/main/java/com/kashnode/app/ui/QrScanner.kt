package com.kashnode.app.ui
import android.Manifest
import android.content.pm.PackageManager
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.camera.core.*
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.lifecycle.compose.LocalLifecycleOwner
import com.google.mlkit.vision.barcode.BarcodeScanning
import com.google.mlkit.vision.common.InputImage
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
@Composable fun QrScanner(onToken:(String)->Unit,onCancel:()->Unit){
 val ctx=LocalContext.current;val owner=LocalLifecycleOwner.current;var granted by remember{mutableStateOf(ContextCompat.checkSelfPermission(ctx,Manifest.permission.CAMERA)==PackageManager.PERMISSION_GRANTED)}
 val ask= rememberLauncherForActivityResult(ActivityResultContracts.RequestPermission()){granted=it};LaunchedEffect(Unit){if(!granted)ask.launch(Manifest.permission.CAMERA)}
 Column(Modifier.fillMaxSize()){Text("Scan pairing QR",style=MaterialTheme.typography.titleLarge)
 if(granted)AndroidView(factory={c->val view=PreviewView(c);val future=ProcessCameraProvider.getInstance(c);val done=AtomicBoolean(false)
 future.addListener({val provider=future.get();val preview=Preview.Builder().build().also{it.surfaceProvider=view.surfaceProvider};val scanner=BarcodeScanning.getClient();val analysis=ImageAnalysis.Builder().setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST).build()
 analysis.setAnalyzer(Executors.newSingleThreadExecutor()){proxy->val media=proxy.image;if(media==null)proxy.close()else scanner.process(InputImage.fromMediaImage(media,proxy.imageInfo.rotationDegrees)).addOnSuccessListener{codes->if(!done.get())codes.firstNotNullOfOrNull{it.rawValue}?.let{raw->val token=runCatching{val j=org.json.JSONObject(raw);require(j.optInt("version")==1);j.getString("pairing_token")}.getOrNull()?:raw.takeIf{it.length in 32..128};if(token!=null&&done.compareAndSet(false,true))onToken(token)}}.addOnCompleteListener{proxy.close()}}
 try{provider.unbindAll();provider.bindToLifecycle(owner,CameraSelector.DEFAULT_BACK_CAMERA,preview,analysis)}catch(_:Exception){}
 },ContextCompat.getMainExecutor(c));view
 },modifier=Modifier.weight(1f).fillMaxWidth())else Text("Camera permission is required.");TextButton(onClick=onCancel){Text("Cancel")}}
}
