package com.ajyma.qada;

import android.os.Bundle;
import androidx.activity.EdgeToEdge;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Отрисовка до краёв экрана (как требует Android 15+); отступы под системные панели
        // задаёт веб-интерфейс через safe-area (Capacitor SystemBars, insetsHandling = css).
        EdgeToEdge.enable(this);
        super.onCreate(savedInstanceState);
    }
}
